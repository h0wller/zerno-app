# Local phone test — HealthKit / Health Connect

This guide runs the current branch against a phone on the same Wi-Fi network. It tests the native bridge and the authenticated `POST /api/fitness/evidence` flow; it does not enable rewards.

## Requirements

- Node.js 22 and installed npm dependencies.
- The phone and development computer must be on the same trusted Wi-Fi network.
- Android: Android Studio/SDK and a physical Android 9+ device with Health Connect installed.
- iOS: macOS with Xcode and a physical iPhone. iOS native builds cannot be produced from Windows.
- No pre-existing account is required. The local test server provides a test-only registration OTP so you can create a verified guest from the phone without Telegram or a real SMS provider.

## 1. Start the local API

From the repository root, use a local development database rather than a production database.

PowerShell:

```powershell
New-Item -ItemType Directory -Force .local | Out-Null
$env:DB_PATH = "$PWD\.local\fitness-phone.db"
$env:PORT = "3000"
$env:NODE_ENV = "test"
$env:SMS_AUTH_ENABLED = "true"
$env:FITNESS_REWARDS_ENABLED = "false"
$env:STRAVA_ENABLED = "false"
node server.js
```

The server listens on port 3000. `app.listen(PORT)` does not restrict the bind address, so Node listens on the available interfaces. Confirm locally:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health
```

If Windows Firewall asks, allow Node.js on **Private networks** only. Do not expose port 3000 to public networks.

## 2. Create a local verified test account

The local server runs with `NODE_ENV=test` and `SMS_AUTH_ENABLED=true`. When you request an SMS registration code from the app, the server does **not** contact an SMS provider: it returns the fixed local-only code `2468`, and the registration UI fills it into the code field.

1. Open the app and choose **Создать профиль**.
2. Enter a name, a phone number not already used in this local database, and a 4-digit PIN.
3. Press **Получить код по SMS**. The UI should show `Локальный тестовый код: 2468`.
4. Submit the registration form and accept the privacy consent. The local guest is created as verified and can use the phone evidence endpoint.

This test-only behavior exists only when `NODE_ENV=test`. Never run this server mode against a production database or deploy it.

## 3. Find the computer's Wi-Fi IPv4 address

Run:

```powershell
ipconfig
```

Use the IPv4 address of the active Wi-Fi adapter, for example `192.168.1.42`. Do not use `127.0.0.1` or the address of a VPN adapter.

## 4. Run the native app against the local server

Keep the API terminal running. In a second terminal:

Android:

```powershell
npx cap run android --live-reload --host 192.168.1.42 --port 3000
```

Replace the example address with the computer's actual Wi-Fi IPv4 address. Capacitor's live-reload mode temporarily points the native WebView at the LAN server; the app then uses that same origin for API requests instead of trying to reach the phone's own `localhost`.

iOS (run this on the Mac, not Windows):

```bash
npx cap run ios --live-reload --host 192.168.1.42 --port 3000
```

On iPhone, allow the **Local Network** permission prompt when it appears. If it was denied earlier, enable Zerno App under Settings → Privacy & Security → Local Network. The iOS target includes a purpose string and the narrow ATS local-network exception for this development connection.

Keep both devices on the same Wi-Fi. If the phone cannot load the app, first check the Windows firewall and whether the phone can open `http://192.168.1.42:3000/api/health` in its browser.

## 5. Send a real phone summary

1. Sign in to the local app as a verified guest.
2. Open the profile.
3. On iPhone, choose **Подключить Apple Health**, grant read access, then load recent running workouts.
4. On Android, choose **Подключить Health Connect**, grant exercise and distance read access, then load recent running workouts.
5. Select **Отправить сводки на проверку**.
6. The UI should report accepted and duplicate counts. The server stores only normalized summary fields; it does not store routes or coordinates.

The native adapters are available only inside the installed Capacitor app. A browser PWA or Telegram Mini App cannot call HealthKit or Health Connect.

## Expected server result

- First submission: HTTP 202, `evidenceState=device_reported`, `verificationState=unverified`, `reward=null`.
- Repeated submission of the same provider record: HTTP 200 with `duplicate=true`.
- No reward is issued from HealthKit/Health Connect summaries in this implementation.
- The endpoint requires a verified guest Bearer session. A clean local database has no signed-in guest until one is created through the application's normal registration flow.

## What this test does not prove

This validates phone-to-local-server connectivity, native permission/read flow, payload normalization, authenticated ingestion and deduplication. It does not cryptographically attest that the installed app is genuine or that a human physically ran. Device evidence remains unverified and cannot issue rewards.
