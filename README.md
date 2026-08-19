# Bag Merge — *Bagaj Atölyesi*

A touchscreen kiosk game built for Turkish Technology's TEKNOFEST stand.
It is the playful, child-facing version of **Bag Globe** — the smart baggage
tracking product — and carries the same message: *every bag has to reach the
right aircraft.*

Aircraft wait at the top of the screen, each with a flight code, a destination
and the suitcase it is waiting for. Below them is a merge grid. Tapping the
baggage belt in the middle of the grid drops souvenirs into the surrounding
cells; two matching souvenirs merge into the next one up the chain, and the
last merge produces that city's suitcase. Drag the suitcase up onto the
matching aircraft to complete the order. Ten orders end the round.

The game itself is in Turkish — it is played by Turkish-speaking children, and
is shown to them under its Turkish name, **Bagaj Atölyesi**.

## Running the game

**On a Mac:** double-click `OYUNU BASLAT.command`.

Opening `index.html` directly does **not** work reliably; the launcher starts a
small local server (`sunucu.py`) to get around the browser's `file://`
restrictions. It uses ports 8223–8240, so it can run alongside Cyber Run.

## Building the kiosk version

```bash
python3 paketle.py
```

This inlines every image, font, the CSS and the JS into a single HTML file
(`~/Desktop/BAG MERGE (tek dosya).html`) that runs by double-clicking — no
server, no Python, works on Windows too. It has to be rebuilt whenever the
game changes.

There is no hand-written asset list: whatever sits in `assets/` is embedded
automatically. Paths built at runtime resolve through `window.GOMULU_ASSETS`.

## Layout

| File | Purpose |
|---|---|
| `index.html` | Screen skeleton (start, game, end) |
| `style.css` | All styling; every measurement derives from one cell size |
| `script.js` | Game engine: grid, machine, merging, orders, scoring |
| `assets/` | Every image and font |
| `sunucu.py` | Local game server (disables caching) |
| `paketle.py` | Builds the single-file distribution |

## Artwork

Artwork is AI-generated and **nothing is drawn in code** — the code only
places, scales and animates the supplied images. Anything still missing from
`assets/` falls back to a plainly-marked temporary box, so the game stays
playable while the art is being produced. Dropping the file in is enough; no
code change is needed.

Expected names:

| File | What it is |
|---|---|
| `item_<city>_1..4.png` | The four steps of that city's merge chain |
| `makine.png` | The baggage belt in the middle of the grid |
| `ucak.png` | The aircraft on an order card |
| `home_page.png` | Start screen design |
| `end_page.png` | End screen design |

Cities currently in play: `paris`, `newyork`, `roma`, `londra`.

## Notes

- The stage is locked to a 9:16 portrait ratio, designed for the kiosk screen.
- Source comments are written in Turkish, matching the team working on it.
- The palette comes from Bag Globe so both stand games look related.
