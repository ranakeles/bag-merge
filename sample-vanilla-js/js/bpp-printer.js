/**
 * BPP (boarding pass printer) helper functions for the TTHS platform.
 *
 * Wraps a TTHSPlatformClient and exposes plain functions for the default
 * boarding pass print, custom CP prints, and printer recovery. The default
 * CP command strings are copied verbatim from the sample-app quick actions
 * (sample-app/src/app/ws-debug-page/page.tsx, "BPP Print" / "BPP (Multiple)").
 *
 * Loaded as a classic script; exposes window.createBppPrinter.
 */
(function (global) {
  "use strict";

  /** Canonical BPP printer device id used by the platform. */
  var BPP_PRINTER_ID = "bpp_printer";

  /**
   * Default boarding pass print command (single coupon, pipe-separated CP| format).
   * Copied verbatim from the sample-app "BPP Print" quick action.
   */
  var DEFAULT_BPP_CP =
    // "CP|1C01|01J|06TEKNOLOJI KASIFI (TEKNOLOJI KASIFI)    |0EOR|13GAP|14SANLIURFA|1FTK NFST|254EKIM|2BGAP|2CGELECEGE|2DGELECEGE|30THY <3 TEKNOFEST|33|3523:59|3A|3B1500P|3C-01-|42|450/0|4BM1MESUT/YILMAZ   ET2GQKW GAPGAPTK NFST 054Y0-01-0001 15E>5181OO1054BTK              2A235383259069001TK                    020KN*30600000K0A02       X|55-|5A|5B|5C|5D|70BAGAJ|71|72|E6|E8001|EA##03|";
    "CP|1C01|01J|06HATIRA BINIS KARTI|0E0|13GAP|14SANLIURFA|1FTURKISH|254EKIM|2BGAP|2CGELECEGE|2DMESUT YILMAZ|30THY <3 TEKNOFEST|33|3523:59|3A-K9-|3B1500P|3C-01-|42|450/0|4BTEKNOFESTE HOSGELDIN MESUT TURK HAVA YOLLARI TEKNOLOJI EKIBI OLARAK BU KODU OKUMANDAN DOLAYI FARKINDALIGIN VE MERAKIN ICIN TEBRIK EDERIZ.|55-|5A|5B|5C|5D|70BAGAJ|71|72|E6TECHNOLOGY|E8001|EA##03|";


  /**
   * Default multiple boarding pass print command (two chained coupons,
   * hash-separated CP# format). Copied verbatim from the sample-app
   * "BPP (Multiple)" quick action.
   */
  var DEFAULT_BPP_CP_MULTIPLE =
    "CP#1C01#01J#06TEKNOLOJI KASIFI (TEKNOLOJI KASIFI)    #0EOR#13GAP#14SANLIURFA#1FTK NFST#254EKIM#2BGAP#2CGELECEGE#2DGELECEGE#30THY <3 TEKNOFEST#33Y#3523:59#3A#3B1500P#3C-01-#42#450/0#4BM1MESUT/YILMAZ   ET2GQKW GAPGAPTK NFST 054Y0-01-0001 15E>5181OO1054BTK              2A235383259069001TK                    020KN*30600000K0A02       X#55-#5A#5B#5C#5D#70BAGAJ#71#72#E6#E8001#EA##03##CP#1C01#01J#06TEKNOLOJI KASIFI (TEKNOLOJI KASIFI)    #0EOR#13GAP#14SANLIURFA#1FTK NFST#254EKIM#2BGAP#2CGELECEGE#2DGELECEGE#30THY <3 TEKNOFEST#33Y#3523:59#3A#3B1500P#3C-01-#42#450/0#4BM1MESUT/YILMAZ   ET2GQKW GAPGAPTK NFST 054Y0-01-0001 15E>5181OO1054BTK              2A235383259069001TK                    020KN*30600000K0A02       X#55-#5A#5B#5C#5D#70BAGAJ#71#72#E6#E8001#EA##03#";

  /** Known printer status codes (mirrors PRINTER_STATUS_BADGES in the sample-app). */
  var STATUS_CODES = {
    PRINT_SUCCESS: { label: "PRINT SUCCESS", ok: true },
    SUCCESS: { label: "SUCCESS", ok: true },
    PAPER_OUT: { label: "PAPER OUT", ok: false },
    PAPER_JAM: { label: "PAPER JAM", ok: false },
    ERR2BTP: { label: "ERR2BTP - Illogical Command", ok: false },
    PRINT_FAILURE: { label: "PRINT FAILURE", ok: false },
    TIMEOUT: { label: "TIMEOUT", ok: false },
    DEVICE_PAUSED: { label: "DEVICE PAUSED", ok: false },
    DEVICE_NOT_AVAILABLE: { label: "DEVICE NOT AVAILABLE", ok: false },
    PRINTER_NOT_CONNECTED: { label: "PRINTER NOT CONNECTED", ok: false },
    DEVICE_NOT_REGISTERED: { label: "DEVICE NOT REGISTERED", ok: false },
    UNKNOWN_DEVICE_ID: { label: "UNKNOWN DEVICE ID", ok: false },
  };

  /**
   * Human-readable labels for the CP field codes whose values carry printed text.
   * Codes not listed here are fixed template/layout codes (01, 0E, 30, EA trailer, ...)
   * and should normally be left untouched.
   */
  var CP_FIELD_LABELS = {
    "2D": "Passenger name",
    "3B": "Points",
    "3C": "Leaderboard Number",
    // "13": "Origin airport",
    // "14": "Destination city",
    // "1F": "Flight number",
    // "25": "Flight date (DDMMM)",
    // "2B": "Destination airport",
    // "2C": "Route text line 1",
    // "2D": "Route text line 2",
    // "30": "Baggage info",
    // "33": "Cabin class",
    // "35": "Boarding time",
    // "45": "Bag count / weight",
    // "70": "Free text",
    // "4B": "BCBP barcode data (M1... fixed-width IATA BCBP)",
  };

  /** Pad/truncate a string with spaces to exactly width characters. */
  function padRight(str, width) {
    str = String(str);
    if (str.length >= width) return str.slice(0, width);
    var padding = new Array(width - str.length + 1).join(" ");
    return str + padding;
  }

  /**
   * Parse a CP command string ("CP|1C01|01J|06NAME|...") into field objects.
   * Each field is { code: "06", value: "TEKNOLOJI KASIFI (TEKNOLOJI KASIFI)    " }. The leading
   * "CP" token and the EA trailer ("EA##03") are kept as regular fields so
   * rebuilding the string round-trips exactly.
   */
  function parseCpCommand(cpString) {
    if (typeof cpString !== "string") return null;
    var body = cpString;
    var prefix = "";
    if (body.indexOf("CP|") === 0) {
      prefix = "CP|";
      body = body.slice(3);
    }
    var fields = body.split("|").map(function (token) {
      if (token.length < 2) {
        return { code: token, value: "" };
      }
      return { code: token.slice(0, 2), value: token.slice(2) };
    });
    return { prefix: prefix, fields: fields };
  }

  /**
   * Build a CP command string by overriding fields of a base CP command
   * (default: the sample-app's DEFAULT_BPP_CP).
   *
   * @param {Object} overrides map of 2-char field code -> new value,
   *                 e.g. { "06": "JOHN DOE", "14": "NEW YORK", "3C": "12A" }
   * @param {string} [baseCp] base command string (optional)
   * @returns {string|null} the rebuilt "CP|..." string, or null on bad input
   */
  function buildBoardingPass(overrides, baseCp) {
    if (!overrides || typeof overrides !== "object") return null;
    var base = typeof baseCp === "string" && baseCp.length > 0 ? baseCp : DEFAULT_BPP_CP;
    var parsed = parseCpCommand(base);
    if (!parsed) return null;

    var fields = parsed.fields.map(function (field) {
      if (Object.prototype.hasOwnProperty.call(overrides, field.code)) {
        var value = overrides[field.code];
        return { code: field.code, value: value == null ? "" : String(value) };
      }
      return field;
    });

    return (parsed.prefix ? parsed.prefix : "") + fields.map(function (f) {
      return f.code + f.value;
    }).join("|");
  }

  /**
   * Parse a BPP-related PlatformData message into a compact result object.
   *
   * Handles both DIRECTIVE_RESULT (print outcomes; status in payload.statusCode
   * or payload.results[].statusCode) and DEVICE_COMMAND_ERROR (queue/health
   * errors; status in payload.statusCode, then payload.errorCode) the same way
   * the sample-app derives its printer status badge.
   */
  function parsePrintResult(msg) {
    if (!msg || !msg.payload) return null;
    var payload = msg.payload;
    var isDirectiveResult = msg.eventType === "DIRECTIVE_RESULT";
    var isDeviceCommandError = msg.eventType === "DEVICE_COMMAND_ERROR";

    var statusCode = payload.statusCode || payload.status || msg.statusCode;
    var errorCode = payload.errorCode || msg.errorCode;

    var printerStatusKey;
    if (isDeviceCommandError) {
      printerStatusKey = statusCode || errorCode;
    } else if (isDirectiveResult) {
      printerStatusKey = statusCode;
      if (!printerStatusKey && Array.isArray(payload.results)) {
        var failedResult = null;
        for (var i = 0; i < payload.results.length; i++) {
          var r = payload.results[i];
          if (r && r.statusCode && r.success === false) {
            failedResult = r;
            break;
          }
        }
        if (failedResult) printerStatusKey = failedResult.statusCode;
      }
    }

    var success = false;
    if (isDirectiveResult) {
      if (Array.isArray(payload.results) && payload.results.length > 0) {
        success = payload.results.every(function (r) {
          return r && r.success === true;
        });
      } else {
        success = true;
      }
    }

    var known = printerStatusKey ? STATUS_CODES[printerStatusKey] : undefined;

    return {
      eventType: msg.eventType,
      correlationId: msg.correlationId || undefined,
      deviceId: payload.deviceId || undefined,
      statusCode: printerStatusKey || undefined,
      statusLabel: known ? known.label : printerStatusKey,
      ok: known ? known.ok : success,
      success: success,
      errorCode: errorCode || undefined,
      errorMessage: payload.errorMessage || msg.errorMessage || "",
      errorMessageTr: payload.errorMessageTr || msg.errorMessageTr || "",
      recommendedAction: payload.recommendedAction || msg.recommendedAction || "",
      results: payload.results || [],
      queueSummary: payload.queueSummary || undefined,
      raw: msg,
    };
  }

  /**
   * Create a BPP printer helper bound to a TTHSPlatformClient.
   *
   * @param {TTHSPlatformClient} client connected platform client
   * @returns {Object} function API: print, printWith, printMultiple,
   *                   reinit, unpause, getLastResult, onPrintResult, parsePrintResult
   */
  function createBppPrinter(client) {
    var lastResult = null;
    var resultHandlers = [];

    function isPrintable() {
      if (!client.isConnected()) {
        console.warn("[BPP] Cannot print: WebSocket is not connected");
        return false;
      }
      if (!client.isInitialized()) {
        console.warn("[BPP] Cannot print: init sequence not complete (application not ACTIVE)");
        return false;
      }
      return true;
    }

    function sendCommands(commands) {
      if (!isPrintable()) return null;
      return client.sendDirective("peripherals_send", {
        deviceId: BPP_PRINTER_ID,
        commands: commands,
      });
    }

    // Route printer events to registered handlers
    client.on("directiveResult", function (msg) {
      if (!msg.payload || msg.payload.deviceId !== BPP_PRINTER_ID) return;
      var result = parsePrintResult(msg);
      if (!result) return;
      lastResult = result;
      resultHandlers.slice().forEach(function (handler) {
        try {
          handler(result);
        } catch (err) {
          console.error("[BPP] Error in print result handler:", err);
        }
      });
    });

    client.on("deviceCommandError", function (msg) {
      if (!msg.payload || msg.payload.deviceId !== BPP_PRINTER_ID) return;
      var result = parsePrintResult(msg);
      if (!result) return;
      lastResult = result;
      resultHandlers.slice().forEach(function (handler) {
        try {
          handler(result);
        } catch (err) {
          console.error("[BPP] Error in print result handler:", err);
        }
      });
    });

    return {
      /** Device id used for all BPP directives. */
      deviceId: BPP_PRINTER_ID,

      /** Default single boarding pass print command string. */
      DEFAULT_BPP_CP: DEFAULT_BPP_CP,

      /** Default chained (two coupon) boarding pass print command string. */
      DEFAULT_BPP_CP_MULTIPLE: DEFAULT_BPP_CP_MULTIPLE,

      /** Print the default boarding pass. Returns the correlationId, or null when not ready. */
      print: function () {
        console.log("[BPP] Printing default boarding pass");
        return sendCommands([DEFAULT_BPP_CP]);
      },

      /** Print a custom CP command string (single or chained). */
      printWith: function (cpString) {
        if (typeof cpString !== "string" || cpString.length === 0) {
          console.warn("[BPP] printWith: cpString must be a non-empty string");
          return null;
        }
        console.log("[BPP] Printing custom boarding pass command");
        return sendCommands([cpString]);
      },

      /**
       * Print the default boarding pass with one or more field values replaced.
       * Extra convenience: a "name" shorthand also rewrites the passenger name
       * inside the 4B BCBP barcode ("M1LASTNAME/FIRSTNAME...").
       *
       * @param {Object} overrides e.g. { "06": "JOHN DOE", "14": "NEW YORK", "3C": "12A" }
       *                   or { name: "JOHN DOE" } for the name shorthand
       * @returns {string|null} correlationId, or null when not ready / bad input
       */
      printFields: function (overrides) {
        overrides = overrides || {};

        // Name shorthand: replace both the 06 text field and the name inside
        // the 4B barcode. Both are fixed-width, so we pad with spaces to the
        // original widths to preserve field positions.
        if (typeof overrides.name === "string" && !Object.prototype.hasOwnProperty.call(overrides, "06")) {
          var parsed = parseCpCommand(DEFAULT_BPP_CP);
          var barcodeField = parsed.fields.find(function (f) {
            return f.code === "4B" && f.value.indexOf("M1") === 0;
          });
          var nameField = parsed.fields.find(function (f) {
            return f.code === "06";
          });
          // if (barcodeField) {
          //   var oldValue = barcodeField.value;
          //   // Old name runs from index 2 until the first space-run of 2+ spaces
          //   var nameEnd = oldValue.indexOf("  ", 2);
          //   if (nameEnd === -1) nameEnd = oldValue.length;
          //   var oldName = oldValue.slice(2, nameEnd);
          //   var newName = overrides.name;
          //   if (newName.length <= oldName.length) {
          //     if (nameField) {
          //       overrides["06"] = padRight(newName, nameField.value.length);
          //     }
          //     overrides["4B"] = "M1" + padRight(newName, oldName.length) + oldValue.slice(nameEnd);
          //   } else {
          //     console.warn("[BPP] Name shorthand skipped: name longer than barcode field width (" + oldName.length + ")");
          //     if (nameField) {
          //       overrides["06"] = newName;
          //     }
          //   }
          // } else if (nameField) {
          //   overrides["06"] = overrides.name;
          // }

          console.log(overrides);
          delete overrides.name;
        }

        var cpString = buildBoardingPass(overrides);
        if (!cpString) {
          console.warn("[BPP] printFields: invalid overrides");
          return null;
        }
        console.log("[BPP] Printing boarding pass with field overrides:", Object.keys(overrides).join(", "));
        return sendCommands([cpString]);
      },

      /** Print the default two-coupon (chained) boarding pass. */
      printMultiple: function () {
        console.log("[BPP] Printing default multiple boarding passes");
        return sendCommands([DEFAULT_BPP_CP_MULTIPLE]);
      },

      /** Re-initialize the printer after an error (peripherals_reinit directive). */
      reinit: function () {
        console.log("[BPP] Sending peripherals_reinit");
        return client.sendDirective("peripherals_reinit", { deviceId: BPP_PRINTER_ID });
      },

      /** Unpause the printer after a peripheral error pause (peripherals_unpause directive). */
      unpause: function () {
        console.log("[BPP] Sending peripherals_unpause");
        return client.sendDirective("peripherals_unpause", { deviceId: BPP_PRINTER_ID });
      },

      /** Last parsed print result (PRINT_SUCCESS, PAPER_OUT, ...), or null. */
      getLastResult: function () {
        return lastResult;
      },

      /**
       * Subscribe to print results. Returns an unsubscribe function.
       * The handler receives the parsed result object from parsePrintResult().
       */
      onPrintResult: function (handler) {
        if (typeof handler !== "function") {
          throw new TypeError("handler must be a function");
        }
        resultHandlers.push(handler);
        return function unsubscribe() {
          var idx = resultHandlers.indexOf(handler);
          if (idx !== -1) resultHandlers.splice(idx, 1);
        };
      },

      /** Static parser exposed for advanced use. */
      parsePrintResult: parsePrintResult,
    };
  }

  // Expose as classic-script globals
  global.createBppPrinter = createBppPrinter;
  global.createBppPrinter.parsePrintResult = parsePrintResult;
  global.createBppPrinter.STATUS_CODES = STATUS_CODES;
  global.createBppPrinter.DEFAULT_BPP_CP = DEFAULT_BPP_CP;
  global.createBppPrinter.DEFAULT_BPP_CP_MULTIPLE = DEFAULT_BPP_CP_MULTIPLE;
  global.createBppPrinter.CP_FIELD_LABELS = CP_FIELD_LABELS;
  global.createBppPrinter.parseCpCommand = parseCpCommand;
  global.createBppPrinter.buildBoardingPass = buildBoardingPass;
})(typeof window !== "undefined" ? window : this);
