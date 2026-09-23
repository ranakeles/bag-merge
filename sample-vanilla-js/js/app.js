/**
 * Background bootstrap for the vanilla JS sample app.
 *
 * On page load this creates the TTHSPlatformClient and the BPP printer helper,
 * then connects and runs the init sequence in the background (no user action
 * required). Everything is exposed on window.KioskSample so the page (or any
 * other script) can drive the platform:
 *
 *   KioskSample.printBoardingPass()   - default BPP boarding pass print
 *   KioskSample.printMultiple()       - default chained (2x) BPP print
 *   KioskSample.reinitBpp()           - peripherals_reinit for the BPP printer
 *   KioskSample.unpauseBpp()          - peripherals_unpause for the BPP printer
 *   KioskSample.connect() / .disconnect() / .restartInit()
 *   KioskSample.client                - the TTHSPlatformClient instance
 *   KioskSample.bpp                   - the BPP printer function API
 */
(function (global) {
  "use strict";

  var MAX_LOG_ENTRIES = 200;

  var client = null;
  var bpp = null;
  var logEntries = [];

  // ---------------------------------------------------------------------------
  // UI helpers (plain DOM, no framework)
  // ---------------------------------------------------------------------------

  function el(id) {
    return document.getElementById(id);
  }

  function setText(id, text) {
    var node = el(id);
    if (node) node.textContent = text;
  }

  function log(direction, data) {
    var entry = {
      direction: direction,
      data: data,
      timestamp: new Date().toISOString(),
    };
    logEntries.push(entry);
    if (logEntries.length > MAX_LOG_ENTRIES) {
      logEntries.splice(0, logEntries.length - MAX_LOG_ENTRIES);
    }
    appendLogEntry(entry);
  }

  function appendLogEntry(entry) {
    var container = el("message-log");
    if (!container) return;

    var item = document.createElement("div");
    item.className = "log-entry " + (entry.direction === "in" ? "log-in" : "log-out");

    var header = document.createElement("div");
    header.className = "log-header";

    var type = "Unknown";
    if (entry.data && entry.data.messageType) {
      type = entry.data.messageType;
      if (entry.data.eventType) type += " / " + entry.data.eventType;
      if (entry.data.directive) type += " / " + entry.data.directive;
    } else if (entry.data && "ping" in entry.data) {
      type = "PING";
    } else if (entry.data && "pong" in entry.data) {
      type = "PONG";
    }

    var label = document.createElement("span");
    label.className = "log-type";
    label.textContent = (entry.direction === "in" ? "RX" : "TX") + ": " + type;

    var time = document.createElement("span");
    time.className = "log-time";
    time.textContent = new Date(entry.timestamp).toLocaleTimeString();

    header.appendChild(label);
    header.appendChild(time);

    var statusKey = extractPrinterStatusKey(entry.data);
    if (statusKey && global.createBppPrinter.STATUS_CODES[statusKey]) {
      var badge = document.createElement("span");
      var known = global.createBppPrinter.STATUS_CODES[statusKey];
      badge.className = "badge " + (known.ok ? "badge-ok" : "badge-error");
      badge.textContent = known.label;
      header.appendChild(badge);
    }

    var body = document.createElement("pre");
    try {
      body.textContent = JSON.stringify(entry.data, null, 2);
    } catch (err) {
      body.textContent = String(entry.data);
    }

    item.appendChild(header);
    item.appendChild(body);
    container.appendChild(item);

    // Keep the DOM bounded together with logEntries
    while (container.children.length > MAX_LOG_ENTRIES) {
      container.removeChild(container.firstChild);
    }

    container.scrollTop = container.scrollHeight;
  }

  /** Same status extraction as parsePrintResult, applied to raw log messages. */
  function extractPrinterStatusKey(data) {
    if (!data || !data.payload) return null;
    var payload = data.payload;
    var isDirectiveResult = data.eventType === "DIRECTIVE_RESULT";
    var isDeviceCommandError = data.eventType === "DEVICE_COMMAND_ERROR";
    if (!isDirectiveResult && !isDeviceCommandError) return null;

    var statusCode = payload.statusCode || payload.status || data.statusCode;
    var key;
    if (isDeviceCommandError) {
      key = statusCode || payload.errorCode || data.errorCode;
    } else {
      key = statusCode;
      if (!key && Array.isArray(payload.results)) {
        for (var i = 0; i < payload.results.length; i++) {
          var r = payload.results[i];
          if (r && r.statusCode && r.success === false) return r.statusCode;
        }
      }
    }
    return key || null;
  }

  function setInitStepStatus(key, status) {
    var node = el("init-step-" + key);
    if (!node) return;
    node.className = "init-step " + (status === "done" ? "init-step-done" : "init-step-sent");
    node.textContent = node.getAttribute("data-label") + (status === "done" ? " - done" : " - sent");
  }

  function resetInitSteps() {
    ["subscribe", "environment", "components", "staterequest"].forEach(function (key) {
      var node = el("init-step-" + key);
      if (!node) return;
      node.className = "init-step";
      node.textContent = node.getAttribute("data-label") + " - pending";
    });
  }

  function showPrinterResult(result) {
    if (!result) return;
    setText("printer-status-label", result.statusLabel || result.statusCode || result.eventType);
    var node = el("printer-status");
    if (node) {
      node.className = "badge " + (result.ok ? "badge-ok" : "badge-error");
      node.style.display = "inline-block";
    }
    setText("printer-status-detail", result.errorMessage || "");
    if (result.recommendedAction) {
      setText("printer-status-detail", (result.errorMessage || "") + " | Action: " + result.recommendedAction);
    }
  }

  function updateConnectionUi() {
    var state = client ? client.getState() : "disconnected";
    var stateNode = el("conn-state");
    if (stateNode) {
      stateNode.textContent = state;
      stateNode.className = "state-" + state;
    }

    var initialized = client && client.isInitialized();
    var initNode = el("app-initialized");
    if (initNode) {
      initNode.textContent = initialized ? "YES" : "NO";
      initNode.className = initialized ? "state-connected" : "state-disconnected";
    }

    var printButtons = ["btn-bpp-print", "btn-bpp-print-multiple"];
    printButtons.forEach(function (id) {
      var btn = el(id);
      if (btn) btn.disabled = !initialized;
    });
  }

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------

  function boot() {
    var config = global.TTHSPlatformClient.parseStartupParams();
    var params = new URLSearchParams(global.location.search);

    // Application identity for the subscribe directive. Defaults to tk-checkin,
    // the platform's DB-seeded default application; override via URL params
    // (?APP-ID=my-app&APP-NAME=My%20App&VENDOR=XX).
    var applicationId = params.get("APP-ID") || "tk-checkin";
    var applicationName = params.get("APP-NAME") || "Turkish Airlines Check-in";
    var vendor = params.get("VENDOR") || "THY";

    console.log("[KioskSample] Resolved startup config:", config);

    client = new global.TTHSPlatformClient({
      wsUrl: config.cussWss,
      applicationId: applicationId,
      applicationName: applicationName,
      vendor: vendor,
      deviceId: config.deviceId,
      oauthUrl: config.oauthUrl,
      autoInit: true,
    });
    bpp = global.createBppPrinter(client);

    // --- Wire client events to the UI -------------------------------------

    client.on("stateChange", updateConnectionUi);
    client.on("initComplete", updateConnectionUi);

    client.on("initStep", function (info) {
      setInitStepStatus(info.key, info.status);
      updateConnectionUi();
    });

    client.on("master", function () {
      resetInitSteps();
      setText("conn-status", "master");
    });

    client.on("rejected", function () {
      setText("conn-status", "rejected");
    });

    client.on("applicationStateChanged", function (msg) {
      setText("app-state", msg.payload.currentState || "UNKNOWN");
    });

    client.on("platformStateChanged", function (msg) {
      setText("platform-state", msg.payload.currentState || "UNKNOWN");
    });

    client.on("message", function (entry) {
      log(entry.direction, entry.data);
    });

    bpp.onPrintResult(showPrinterResult);

    // --- Expose the public API --------------------------------------------

    global.KioskSample = {
      /** The TTHSPlatformClient instance. */
      client: client,
      /** The BPP printer function API (print, printWith, printMultiple, reinit, unpause...). */
      bpp: bpp,
      /** Print the default boarding pass on the BPP printer. */
      printBoardingPass: function () {
        return bpp.print();
      },
      /** Print the default chained (two coupon) boarding pass. */
      printMultiple: function () {
        return bpp.printMultiple();
      },
      /** Re-initialize the BPP printer after an error. */
      reinitBpp: function () {
        return bpp.reinit();
      },
      /** Unpause the BPP printer after a peripheral error pause. */
      unpauseBpp: function () {
        return bpp.unpause();
      },
      /** Connect to the platform (init runs automatically after master). */
      connect: function () {
        client.connect();
      },
      /** Disconnect from the platform. */
      disconnect: function () {
        client.disconnect();
      },
      /** Re-run the 4-step init sequence on the open connection. */
      restartInit: function () {
        resetInitSteps();
        client.restartInit();
      },
    };

    // --- Wire demo buttons --------------------------------------------------

    bindClick("btn-bpp-print", function () {
      global.KioskSample.printBoardingPass();
    });
    bindClick("btn-bpp-print-multiple", function () {
      global.KioskSample.printMultiple();
    });
    bindClick("btn-bpp-reinit", function () {
      global.KioskSample.reinitBpp();
    });
    bindClick("btn-bpp-unpause", function () {
      global.KioskSample.unpauseBpp();
    });
    bindClick("btn-restart-init", function () {
      global.KioskSample.restartInit();
    });
    bindClick("btn-connect", function () {
      global.KioskSample.connect();
    });
    bindClick("btn-disconnect", function () {
      global.KioskSample.disconnect();
    });
    bindClick("btn-clear-log", function () {
      logEntries = [];
      var container = el("message-log");
      if (container) {
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
      }
    });

    // Show the resolved endpoint in the header
    setText("ws-url", client.getConfig().cussWss);
    setText("device-id", config.deviceId);
    updateConnectionUi();

    // --- Connect in the background (no user action required) ---------------

    console.log("[KioskSample] Connecting to platform in the background");
    client.connect();
  }

  function bindClick(id, handler) {
    var btn = el(id);
    if (!btn) return;
    btn.addEventListener("click", function () {
      try {
        handler();
      } catch (err) {
        console.error("[KioskSample] Button handler error (" + id + "):", err);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof window !== "undefined" ? window : this);
