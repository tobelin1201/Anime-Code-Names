# ⛩️ Anime Codenames

Codenames with anime characters. Two teams, one board, and everyone plays on their own phone in the same room.

- **316 characters** from 60+ series in three groups: popular shonen (Naruto, One Piece, Demon Slayer, JJK…), classics (Sailor Moon, Evangelion, Ghibli, Pokémon…) and recent hits (Frieren, Spy x Family, Chainsaw Man, Dandadan…).
- **Custom characters**: the host can add their own names, with an optional Japanese name.
- **Translations**: the interface comes in English, Español, Français and 日本語. Every card can show the English name, the Japanese name, or both.
- **Live sync**: spymasters' phones show the secret key, operatives' phones show the plain board, and every tap shows up for everyone right away.
- **Invite with a QR code** or a 4-letter room code.
- **Two-tap reveal**, so a slip of the thumb doesn't cost your team a turn. The host also has **Undo**.

## How to play

1. One person taps **Create a game**, enters their name and picks a team and role. That person is the host.
2. Everyone else scans the QR code (or opens the link, or types the room code), picks a team, and picks **Spymaster** or **Operative**. Each team needs one spymaster.
3. On your team's turn, the spymaster says **one word and a number** out loud (e.g. "Pirates 2"). They can also type it into the app so it shows on everyone's screen.
4. Operatives tap a card, then tap it again to confirm. Hit your own color and you keep guessing (up to the number + 1). Hit a bystander or the other team's card and your turn ends.
5. Find all your characters first to win. Tap the 💀 assassin and you lose immediately.

**Only one device?** Open ⚙️ Settings and turn on *Anyone can tap cards*. Put the board on a TV or laptop and have the spymasters join on their phones to see the key.

## Running it

It's a static site with no build step and nothing to install.

```bash
npm start          # serves on http://localhost:8000 (needs Python 3)
npm test           # runs the game-rule tests (Node 20+)
```

### Publish free on GitHub Pages

1. Merge into `main`.
2. In the repository, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. The included workflow deploys every push to `main`. Your game will be at `https://<your-username>.github.io/<repo-name>/`.

## How the sync works

The host's browser is the referee. Every other phone sends its taps to the host, and the host sends each player their own view of the board. Operatives' phones are never sent the secret key.

Phones reach the host in two ways, both tried automatically:

1. **Relay (main path):** messages go through free public MQTT brokers ([EMQX](https://www.emqx.com/en/mqtt/public-mqtt5-broker) and [HiveMQ](https://www.hivemq.com/mqtt/public-mqtt-broker/)) over secure WebSockets. This works on almost any network. The brokers are public, so every message is end-to-end encrypted between each player and the host (ECDH key exchange + AES-GCM), and the broker only ever sees ciphertext.
2. **Direct (fallback):** a peer-to-peer WebRTC link via [PeerJS](https://peerjs.com/), used if neither broker can be reached.

- If the host refreshes or briefly loses signal, the game is saved on their device and everyone reconnects automatically.
- If the host closes the game, it ends for everyone. They can pick it back up later with **Resume hosting** on the home screen.
- If a phone still can't connect, the join screen offers **Retry** after 15 seconds. Switching between Wi-Fi and mobile data usually fixes strict networks.

To use your own servers, add this before the scripts in `index.html`:

```html
<script>
  window.ACN_RELAYS = ['wss://mqtt.example.com:8084/mqtt'];
  window.ACN_PEER_CONFIG = { host: 'peer.example.com', port: 443, path: '/', secure: true };
</script>
```

## Project layout

| File | What it does |
| --- | --- |
| `js/characters.js` | The character deck (English + Japanese names), grouped by series |
| `js/game.js` | Game rules as pure functions (key layout, turns, win conditions, per-player views) |
| `js/net.js` | Host and client networking: encrypted MQTT relay plus PeerJS fallback |
| `js/i18n.js` | Interface translations. Copy the `en` block to add a language |
| `js/app.js` | Screens, rendering, and the host's referee loop |
| `vendor/` | Pinned copies of mqtt.js 5.10.1, PeerJS 1.5.4 and qrcode-generator 1.4.4 |

*Codenames is a game by Vlaada Chvátil (Czech Games Edition). This is an unofficial fan project for playing with friends. Character names belong to their respective creators.*
