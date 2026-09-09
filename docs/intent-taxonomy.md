# AppleSupport Intent Taxonomy (Data-Driven Discovery)

This taxonomy defines the 9 core customer support intents for `@AppleSupport`, derived from empirical frequency and n-gram analysis of **74,426 initial customer inquiries** in the `thoughtvector/customer-support-on-twitter` dataset.

---

## 1. Summary of Discovered Intents

| # | Intent ID | Display Name | Analyzed Inquiries | Share % | Dominant Historical Resolution Pattern |
| :-: | :--- | :--- | :-: | :-: | :--- |
| 1 | `software_update` | OS Update & Installation Issues | 11,750 | 15.8% | Storage cleanup, iTunes restore, delete update file |
| 2 | `battery_power` | Battery & Power Performance | 8,519 | 11.4% | Battery usage check, Low Power Mode, hard reboot |
| 3 | `display_hardware` | Screen, Touch & Physical Freeze | 6,428 | 8.6% | Force restart key sequence, Genius Bar booking |
| 4 | `keyboard_typing` | Keyboard, Typing & Autocorrect Bug | 6,111 | 8.2% | Settings > General > Keyboard Text Replacement |
| 5 | `apps_appstore` | App Store Downloads & App Crashes | 4,109 | 5.5% | Reinstall app, sign out of Media & Purchases |
| 6 | `audio_media` | Apple Music, Audio & Media Playback | 3,860 | 5.2% | Toggle iCloud Music Library, reset AirPods |
| 7 | `account_icloud` | Apple ID, iCloud & Account Security | 3,459 | 4.6% | `iforgot.apple.com`, manage iCloud storage |
| 8 | `connectivity_network` | Connectivity, Wi-Fi & Bluetooth | 3,365 | 4.5% | Reset Network Settings, toggle Airplane mode |
| 9 | `billing_subscriptions` | Billing, App Store Purchases & Refunds | 1,939 | 2.6% | `reportaproblem.apple.com`, manage Subscriptions |
| — | *unclassified_other* | Out-of-Scope / General Banter / Retail | 24,886 | 33.4% | Human routing / store inquiry / out-of-scope |

**Total Inquiries Analyzed**: 74,426 root customer tickets  
**Classified into 9 Core Intents**: 49,540 (66.6%)  

---

## 2. Global Disambiguation & Precedence Rule

> [!IMPORTANT]
> **The Temporal Trigger vs. Functional Symptom Rule**:  
> In Twitter customer support, customers frequently mention an OS update as the temporal trigger (*"Ever since I updated to iOS 11, my battery dies in 2 hours"* or *"After updating, my screen is completely frozen"*).  
> **Precedence Rule**: If an inquiry mentions both an OS update and a specific hardware or functional symptom (`battery_power`, `display_hardware`, `keyboard_typing`, `connectivity_network`), the inquiry is **classified into the specific functional symptom intent**, because support resolution requires diagnosing that symptom, not teaching the user how to install an update. `software_update` is strictly reserved for issues where the update mechanism itself fails.

---

## 3. Detailed Intent Specifications

### 1. `software_update` — OS Update & Installation Issues
- **Definition**: Customer encounters an error while checking for, downloading, preparing, installing, or verifying an iOS or macOS system update.
- **Inclusion Criteria**: Inability to complete update ("Unable to Verify Update", "An error occurred downloading iOS"), update stuck on Apple logo/progress bar, insufficient space to install update, questions about how to downgrade/revert to previous OS version.
- **Exclusion Criteria**: Inquiries where the update is already installed and customer is reporting a specific broken feature like battery drain or keyboard glitch (classify under the functional intent).
- **Representative Real Customer Examples**:
  - *Tweet 736*: `"Thank you I updated my phone and now it is even slower and barely works. Thank you for ruining my phone.😤"`
  - *Tweet 758*: `"Hey ! Last time I downloaded an update my freaking phone gave me hell. Any recommendations?"`
  - *Tweet 2650*: `"really needs to fix this update. My phone has never been slower, for real."`
- **Likely Resolution Pattern**: Advise deleting corrupted update file in *Settings > General > iPhone Storage*, reconnecting to reliable Wi-Fi, or updating via iTunes on a computer.
- **Escalation Boundary**: Device trapped in a boot-loop (Apple logo flashing) requiring DFU mode or in-person recovery.
- **Confusing / Overlapping Intents**: Overlaps with `battery_power` and `display_hardware` when users mention update as the cause.

---

### 2. `battery_power` — Battery & Power Performance
- **Definition**: Rapid battery depletion, unexpected device shutdowns (e.g. dying at 30%), failure to hold charge, or excessive heat generation during charging or normal use.
- **Inclusion Criteria**: Explicit mention of battery percentage, charging failures, charger/cable issues, battery health questions, device shutting off spontaneously while indicating remaining charge.
- **Exclusion Criteria**: Phone shutting off because of water damage or screen staying black without power indicator (classify as `display_hardware`).
- **Representative Real Customer Examples**:
  - *Tweet 767*: `"I just need to do something about the battery life because it sucks ass"`
  - *Tweet 1761*: `"iOS 11 is killing my battery . Fix it."`
  - *Tweet 2616*: `"why is my battery life short? I updated to 11.1, my battery is poor. Wife didn’t she likes her battery life"`
  - *Tweet 3767*: `"I’m no expert in battery life but 40% doesn’t go to 7% in 5minutes"`
- **Likely Resolution Pattern**: Instruct customer to inspect *Settings > Battery* to identify rogue background apps, enable Low Power Mode, or check Battery Health.
- **Escalation Boundary**: Physical swelling of the battery, device casing separating, or extreme overheating posing a safety hazard $\rightarrow$ Immediate human/store escalation.
- **Confusing / Overlapping Intents**: `software_update` (customers blaming the update).

---

### 3. `display_hardware` — Screen, Touch & Physical Freeze
- **Definition**: Unresponsive touchscreen, visual artifacts (lines, flickering), black screen of death, frozen UI/lock screen, or physical device damage.
- **Inclusion Criteria**: Touch gestures not registering, ghost touches, display frozen on lock screen, black screen where phone still vibrates/rings, cracked screen, broken home button, Face ID hardware failure.
- **Exclusion Criteria**: Screen freeze isolated to a single third-party app (classify as `apps_appstore`).
- **Representative Real Customer Examples**:
  - *Tweet 756*: `"MY HOME BUTTON DOESN’T WORK #IOS11"`
  - *Tweet 2624*: `"It’s been a few days since made me update my phone’s operating system. Now constantly glitching, hmm 🤔 I’m shocked!"`
  - *Tweet 2678*: `"Any idea why icons show up like this? I did force reset to no avail. After initial notification display, they show up."`
- **Likely Resolution Pattern**: Provide hardware force-restart instructions (Volume Up $\rightarrow$ Volume Down $\rightarrow$ hold Side button).
- **Escalation Boundary**: Physically cracked glass, liquid ingress, or complete touch hardware failure requiring display module replacement $\rightarrow$ Schedule Genius Bar appointment.
- **Confusing / Overlapping Intents**: `apps_appstore` (freeze inside one app vs system-wide freeze).

---

### 4. `keyboard_typing` — Keyboard, Typing & Autocorrect Bug
- **Definition**: Text entry problems, keyboard lag, disappearing on-screen keyboard, or predictive text substitutions (especially the historic iOS 11.1 letter 'I' substitution bug).
- **Inclusion Criteria**: Typing the letter 'I' produces 'A [?]', keyboard freezes while typing, autocorrect inserting wrong words repeatedly, third-party keyboard not appearing.
- **Exclusion Criteria**: Entire screen touch unresponsive (classify as `display_hardware`).
- **Representative Real Customer Examples**:
  - *Tweet 719*: `"Tf is wrong with my keyboard"`
  - *Tweet 730*: `"Hello, internet. Can someone explain why this symbol keeps appearing on my phone and when I try to type the letter I? Also"`
  - *Tweet 1755*: `"Why does my I not work ?! please fix this!!!"`
  - *Tweet 4882*: `"tell me why I’I’ve updated my phone twice and I can’t type letter I without getting a letter A and a question mark"`
- **Likely Resolution Pattern**: Instruct user to configure *Settings > General > Keyboard > Text Replacement* (add phrase "I" with shortcut "i") or update to iOS 11.1.1.
- **Escalation Boundary**: MacBook butterfly keyboard physical switch failure (keys physically sticking or repeating).
- **Confusing / Overlapping Intents**: `software_update` (since this bug emerged directly in iOS 11.1).

---

### 5. `apps_appstore` — App Store Downloads & App Crashes
- **Definition**: Troubles downloading or updating apps from the App Store, or specific applications (e.g., YouTube, WhatsApp, Mail) crashing on launch.
- **Inclusion Criteria**: App Store download circle spinning indefinitely, "Waiting..." status on app icons, specific apps crashing repeatedly upon opening.
- **Exclusion Criteria**: App Store billing/subscription payment decline (classify as `billing_subscriptions`).
- **Representative Real Customer Examples**:
  - *Tweet 749*: `"Hi! What is going on? Has Youtube lost it? What can be done about it? Thanks for the support!"`
  - *Tweet 1779*: `"my PHONE app doesn’t work. Thank you for updating my #iPhone to an #ipod"`
  - *Tweet 1791*: `"why won’t my apps fuccin download or update"`
  - *Tweet 2645*: `"when will the bug in the calendar app be fixed? I upgraded to iOS 11.1 and it still crashes when iOS 11.03"`
- **Likely Resolution Pattern**: Force quit app, delete and reinstall, verify App Store date & time settings, sign out and sign back into App Store.
- **Escalation Boundary**: Developer-wide service outage (external API failure) or recurring kernel panic upon opening core system apps.
- **Confusing / Overlapping Intents**: `display_hardware` (app crash vs OS freeze).

---

### 6. `audio_media` — Apple Music, Audio & Media Playback
- **Definition**: Failure of audio output, speaker/microphone malfunctions, Apple Music syncing issues, or AirPods/EarPods hardware connection problems.
- **Inclusion Criteria**: Missing Apple Music tracks, offline music not playing, no sound during phone calls, distorted/crackling speaker, microphone not recording voice memos, AirPods cutting out.
- **Exclusion Criteria**: Cellular call drops caused by cell tower reception (classify as `connectivity_network`).
- **Representative Real Customer Examples**:
  - *Tweet 1781*: `"why can’t I change ringer volume with the buttons? Whose dumb idea was it to change that and how do they still have a job?"`
  - *Tweet 2620*: `"watchOs4 made my watch pointless Browsing music on my phone via the watch was 80% reason for buying it now it’s useless."`
  - *Tweet 2632*: `"And why is my music NEVER in my control center?!"`
  - *Tweet 11101*: `"music and podcast “skip” around like a CD, then distorts and clears up in few seconds, only happens after iOS 11"`
- **Likely Resolution Pattern**: Guide user to toggle *iCloud Music Library*, inspect Control Center volume, clean speaker grilles, or reset AirPods.
- **Escalation Boundary**: Blown physical speaker diaphragm or water damage in microphone port $\rightarrow$ Hardware repair.
- **Confusing / Overlapping Intents**: `connectivity_network` (Bluetooth headphones dropping connection).

---

### 7. `account_icloud` — Apple ID, iCloud & Account Security
- **Definition**: User identity, Apple ID authentication, forgotten credentials, two-factor authentication (2FA) verification, or iCloud storage quota issues.
- **Inclusion Criteria**: "Apple ID has been locked for security reasons", forgotten Apple ID or password, verification code not received, iCloud backup failing, "iCloud Storage Is Full".
- **Exclusion Criteria**: Billing issues tied to an Apple ID (classify as `billing_subscriptions`).
- **Representative Real Customer Examples**:
  - *Tweet 1764*: `"Hello, I need some help regarding the region change on my Apple ID"`
  - *Tweet 2635*: `"Just updated iOS on iPhone7, now iCloud backup greyed out, cannot be turned on, says “Last Backup Never”"`
  - *Tweet 6554*: `"how long does it take usually for account recovery to get back to you? It’s been about a week now."`
  - *Tweet 8437*: `"suck! Upgrade phone & I lose my Apple ID. Can’t get new id without old & can’t book Genius bar help appointment without ID!!! #stupid"`
- **Likely Resolution Pattern**: Direct to `iforgot.apple.com` for password reset, explain trusted device verification, guide storage management in *Settings > [Name] > iCloud*.
- **Escalation Boundary**: Suspicion of account takeover, lost access to all trusted phone numbers and recovery keys $\rightarrow$ Account Recovery queue / human specialist.
- **Confusing / Overlapping Intents**: `billing_subscriptions` (App Store asking for Apple ID credentials before purchase).

---

### 8. `connectivity_network` — Connectivity, Wi-Fi & Bluetooth
- **Definition**: Wireless networking, cellular carrier signal, Wi-Fi connectivity, Bluetooth device pairing, or AirDrop transfer failures.
- **Inclusion Criteria**: Wi-Fi toggle greyed out, dropping home Wi-Fi connection, "No Service" / "Searching..." carrier error, Bluetooth failing to pair with car or third-party accessory, AirDrop failing to discover contacts.
- **Exclusion Criteria**: Inability to browse due to expired cellular data plan (carrier billing).
- **Representative Real Customer Examples**:
  - *Tweet 2642*: `"still no reliable Bluetooth on my iPhone 8+."`
  - *Tweet 2659*: `"Is anyone else having problems with there iPhone 7 saying no service?"`
  - *Tweet 4879*: `"I can’t download songs. Progress icon keeps spinning. On both data + WiFi. Stream works though. Can’t add songs to playlists."`
  - *Tweet 5849*: `"I updated to iOS 11 and my iPhone 6 stopped connecting to wi-fi. Already restored the phone and the network connections"`
- **Likely Resolution Pattern**: Direct user to *Settings > General > Reset > Reset Network Settings*, toggle Airplane Mode for 10 seconds, remove and reinsert SIM card.
- **Escalation Boundary**: Hardware baseband modem failure (common in iPhone 7 "No Service" recall program) $\rightarrow$ Hardware replacement.
- **Confusing / Overlapping Intents**: `audio_media` (AirPods Bluetooth pairing vs general Bluetooth).

---

### 9. `billing_subscriptions` — Billing, App Store Purchases & Refunds
- **Definition**: Monetary transactions, unwanted credit card charges from iTunes/Apple, active subscription cancellations, and refund claims.
- **Inclusion Criteria**: Unauthorized purchase, credit card charged twice for an app, questions on how to cancel Apple Music or iCloud subscriptions, refund requests for accidental in-app purchases, payment method declined errors.
- **Exclusion Criteria**: App crashes after purchase (classify as `apps_appstore`).
- **Representative Real Customer Examples**:
  - *Tweet 9180*: `"I bought an iTunes gift card worth £15 a week ago, and the email still hasn’t come into my inbox to tell me the code. Helpppp"`
  - *Tweet 18872*: `"the screen on our iPad Pro has stopped working 😔. I've read a few articles about weak screens on some models - is there anywhere I can check the model number, or will it be a £400 repair bill? Thanks"`
  - *Tweet 22988*: `"Trying to download an app to a family member's phone that I purchased as the family group organizer. Being asked to purchase it, but I don't want to be charged again. Suggestions?"`
- **Likely Resolution Pattern**: Instruct user to visit `reportaproblem.apple.com` to review invoice history and claim refunds, or cancel subscription in *Settings > [Name] > Subscriptions*.
- **Escalation Boundary**: Stolen credit cards, fraudulent identity theft, or disputes involving large financial charges $\rightarrow$ Immediate transfer to Apple Billing Support.
- **Confusing / Overlapping Intents**: `account_icloud` (Apple ID credentials needed for billing).
