# sample-vanilla-js

A dependency-free vanilla JavaScript client for the TTHS kiosk platform. It replicates
the WebSocket connection and initialization flow of the Next.js `sample-app`
(`ws-debug-page`) without any framework, bundler, or npm install, and takes a
boarding pass printout from the BPP printer through the platform.

Everything runs in the background automatically: opening the page connects to the
platform, waits for `ConnectionStatus: master`, ACK-chains the four init steps, and
leaves the application ACTIVE, ready to print.

## Running

The platform backend must be reachable at `ws://localhost:8000/platform/subscribe`
(default). Then simply open the page:

- Open `index.html` directly in a browser (`file://` works, classic scripts only), or
- Serve the folder statically, e.g. `python3 -m http.server 9090` inside
  `sample-vanilla-js/` and open `http://localhost:9090`.

To see how to import the client into **your own** HTML page and print with a single
function call, open [`sampleImport.html`](sampleImport.html) - a bare page that only
adds the three script tags and its own small form, then calls
`KioskSample.bpp.printFields({ ... })`.

### URL parameter overrides (CUSS 2.0 Section 3.1.2 startup parameters)

```
http://localhost:9090/?VENDOR=TK&APCD=IST&ALCD=TK&DEVICE-ID=NONE&OAUTH-URL=https://localhost:8443/oauth&CUSS-WSS=ws://localhost:8000/platform/subscribe
```

| Parameter | Purpose | Default |
|---|---|---|
| `CUSS-WSS` | Platform WebSocket URL | `ws://localhost:8000/platform/subscribe` |
| `DEVICE-ID` | CUSS device id used in `meta.deviceID` | `NONE` |
| `APP-ID` / `APP-NAME` / `VENDOR` | Application identity sent in the `subscribe` directive | `tk-checkin` / `Turkish Airlines Check-in` / `THY` (the platform's DB-seeded default application) |
| `OAUTH-URL` | OAuth URL (used as `oauthToken` placeholder, like the sample-app) | `https://localhost:8443/oauth` |

Example: `?APP-ID=my-app&APP-NAME=My%20App` subscribes as `my-app` instead of `tk-checkin`. Any id is accepted - the platform registers unknown applications on the fly.

## Function API (`window.KioskSample`)

Exposed by `js/app.js` after page load:

| Function | Description |
|---|---|
| `KioskSample.printBoardingPass()` | Default BPP boarding pass print (sample-app's `CP\|` command, verbatim). Returns the correlationId, or `null` when not connected/initialized. |
| `KioskSample.printMultiple()` | Default two-coupon chained `CP#` print. |
| `KioskSample.bpp.printWith(cpString)` | Print a custom CP command string. |
| `KioskSample.bpp.printFields(overrides)` | Print the default boarding pass with field values replaced, e.g. `printFields({ "06": "JOHN DOE", "14": "NEW YORK", "3C": "12A" })`. The `name` shorthand (`printFields({ name: "DOE/JOHN" })`) also rewrites the name inside the BCBP barcode. |
| `KioskSample.reinitBpp()` | `peripherals_reinit` for `bpp_printer` (recovery after printer errors). |
| `KioskSample.unpauseBpp()` | `peripherals_unpause` for `bpp_printer` (clear peripheral error pause). |
| `KioskSample.connect()` / `.disconnect()` | Manual connection control. |
| `KioskSample.restartInit()` | Re-run the 4-step init sequence on the open connection. |
| `KioskSample.client` | The `TTHSPlatformClient` instance (event emitter, `sendDirective`, ...). |
| `KioskSample.bpp` | The BPP printer helper (`print`, `printWith`, `printMultiple`, `reinit`, `unpause`, `getLastResult`, `onPrintResult`). |

### Class API (`window.TTHSPlatformClient`)

`js/platform.js` exposes the reusable client class if you want to embed it in your own page:

```js
const client = new TTHSPlatformClient({
  wsUrl: "ws://localhost:8000/platform/subscribe",
  applicationId: "tk-checkin",     // subscribe applicationId (any id is accepted)
  applicationName: "Turkish Airlines Check-in",
  vendor: "THY",
  autoInit: true,            // run the 4-step init after ConnectionStatus: master
  pingTimeoutMs: 90000,      // reconnect when no PING within this window
  backoff: { initialDelay: 1000, maxDelay: 30000, multiplier: 2 },
});
client.on("initComplete", () => console.log("application is ACTIVE"));
client.connect();
```

Events: `stateChange`, `message`, `connectionStatus`, `master`, `rejected`, `close`,
`error`, `initStep`, `initComplete`, `apiAcknowledgement`, `directiveResult`,
`deviceCommandError`, `deviceStatusChanged`, `applicationStateChanged`,
`platformStateChanged`, `componentList`.

## How it works (copied from the sample-app)

1. **Connect** to `/platform/subscribe`; do nothing until `ConnectionStatus: master`
   (a `rejected` status means another master is active - no auto-reconnect).
2. **Init (ACK-chained)**: `subscribe` -> `platform_environment` ->
   `platform_components` -> `platform_applications_staterequest` (ACTIVE). Each step
   waits for the `APIAcknowledgement` echoing its `requestID`/`correlationId` before
   sending the next (200 ms pacing, like the sample-app).
3. **Keep-alive**: every platform `PING` is answered with `PONG`; if no PING arrives
   within 90 s the connection is dropped and reconnected with exponential backoff
   (1 s -> 30 s, 2x).
4. **Print**: `peripherals_send` with `deviceId: "bpp_printer"` and the default
   `CP|...` command string; the result arrives as `DIRECTIVE_RESULT`
   (`payload.results[]`, statusCode e.g. `PRINT_SUCCESS`, `PAPER_OUT`) or
   `DEVICE_COMMAND_ERROR` (`payload.statusCode` / `errorCode`).

**Message format note:** every outgoing message carries `directive` and
`correlationId` at the **top level** (plus `meta` for CUSS 2.0 spec compliance),
because the platform's `onApplicationData` routes directives on the top-level
field only - a `meta`-only message is rejected with "is not subscribed".

Full protocol reference: [`../WEBSOCKET_GUIDE.md`](../WEBSOCKET_GUIDE.md)

## Changing the printed texts (CP field overrides)

The `CP|` command is a field-coded string: `|`-separated fields, each starting with a
2-character code followed by the value (`06MESUT YILMAZ    ` = field `06`, passenger
name). Editable text fields (see `createBppPrinter.CP_FIELD_LABELS` for the full list):

| Code | Sample value | Meaning |
|---|---|---|
| `06` | `MESUT YILMAZ` | Passenger name |
| `13` / `2B` | `CDG` / `SAW` | Origin / destination airport |
| `14` | `PARIS` | Destination city |
| `1F` | `TK 7765` | Flight number |
| `25` | `23FEB` | Flight date |
| `2C` / `2D` | `ISTANBUL-SAW` | Route text lines |
| `33` | `Y` | Cabin class |
| `35` / `3B` | `13:55` / `13:15` | Boarding / departure time |
| `3C` | `18B` | Seat number |
| `70` | `APIS OK` | Free text |

Other codes (`01`, `0E`, `30`, `EA##03` trailer, ...) are fixed template/layout
codes - leave them untouched. Utilities: `createBppPrinter.parseCpCommand(cp)` returns
`[{ code, value }, ...]`, `createBppPrinter.buildBoardingPass(overrides, baseCp?)`
returns the rebuilt command string.

**Barcode caveat:** the `4B` field is the machine-readable IATA BCBP barcode
(`M1NAME...`, fixed-width). Changing only the `06` text field leaves the old name
encoded in the barcode; use the `name` shorthand or pass a correctly padded `"4B"`
value to keep both in sync.

## File layout

```
sample-vanilla-js/
├── index.html        Demo page (classic script tags, works from file://)
├── sampleImport.html Example: importing the scripts into a different page + single-function print
├── css/style.css     Minimal styling
└── js/
    ├── platform.js    TTHSPlatformClient: connection, PING/PONG, backoff, 4-step init
    ├── bpp-printer.js createBppPrinter(): default/custom BPP print + recovery functions
    └── app.js         Background bootstrap + window.KioskSample + demo UI wiring
```
