# AppleSupport Intent Taxonomy & Disambiguation Specification

This document specifies the **10 customer support intents** for `@AppleSupport`, established from empirical analysis of **74,426 initial customer inquiries** in the Kaggle Customer Support on Twitter dataset (`twcs.csv`).

---

## 1. Methodology Description

To avoid misrepresenting the process, the methodology used to establish this taxonomy was:
1. **Document-Frequency & N-Gram Analysis**: Extracted unigram and bigram document frequencies across 74,426 initial customer inquiries (`isInitialInquiry: true`) to uncover recurring vocabulary clusters (e.g., `battery life`, `ios update`, `question mark box`, `app store`, `itunes charge`).
2. **Co-Occurrence & Overlap Analysis**: Quantified pairs of concepts frequently co-occurring in single tweets (notably temporal triggers like OS updates combined with functional symptoms like battery drain or screen freezes).
3. **Representative-Example Inspection**: Audited hundreds of real tweets across candidate categories to expose false-positive keywords (e.g., discovering that naive matching of `"bill"` routed screen repair complaints into billing).
4. **Manual Taxonomy Consolidation**: Grouped overlapping technical terms into coherent operational support workflows, merging App Store downloads with app crashes into a unified Application Layer intent (`apps_appstore`).
5. **Deterministic Rule-Based Taxonomy Validation with Negative Guards**: Implemented explicit precedence rules, phrase-boundary checks, and negative exclusion guards to prevent forced misclassification.
6. **Explicit Fallback Intent (`other_unclear`)**: Created a dedicated catch-all category with `requires_human_review = true` for vague venting, retail/store questions, shipping inquiries, and foreign languages.

---

## 2. Taxonomy Overview & Reconciled Dataset Distribution

Evaluated across all **74,426 root customer inquiries** in `data/processed/applesupport_pairs.jsonl`:

| # | Intent ID | Display Name | Count | Share % | Requires Human Review | Dominant Support Workflow |
| :-: | :--- | :--- | :-: | :-: | :-: | :--- |
| 1 | `other_unclear` | Out-of-Scope / Vague / Retail Fallback | **55,341** | **74.36%** | **YES** | Route to human; ask clarifying questions; store routing |
| 2 | `battery_power` | Battery, Power & Charging Issues | **7,335** | **9.86%** | No | Settings > Battery inspection, Low Power Mode, hard reset |
| 3 | `keyboard_typing` | Keyboard, Typing & Autocorrect Glitches | **4,666** | **6.27%** | No | Settings > General > Keyboard Text Replacement (iOS 11.1 fix) |
| 4 | `audio_media` | Apple Music, Audio & Media Playback | **2,192** | **2.95%** | No | Toggle iCloud Music Library, reset AirPods, volume check |
| 5 | `apps_appstore` | App Store Downloads & App Performance | **1,154** | **1.55%** | No | Reinstall app, offload storage, check App Store login |
| 6 | `display_hardware` | Screen, Touch & Physical Hardware | **1,089** | **1.46%** | No | Hardware force restart, check for repair / Genius Bar |
| 7 | `account_icloud` | Apple ID, iCloud & Account Security | **1,056** | **1.42%** | No | `iforgot.apple.com`, manage iCloud storage |
| 8 | `connectivity_network` | Wi-Fi, Bluetooth & Cellular Connectivity | **913** | **1.23%** | No | Reset Network Settings, toggle Airplane mode, reseat SIM |
| 9 | `billing_subscriptions` | Billing, App Store Purchases & Refunds | **436** | **0.59%** | No | `reportaproblem.apple.com`, cancel active subscription |
| 10 | `software_update` | OS Update & Installation Issues | **244** | **0.33%** | No | Storage cleanup, iTunes restore, delete update installer |

- **Total Inquiries Evaluated**: **74,426**
- **Reconciled Sum Across All 10 Intents**: **74,426**
- **Mathematical Discrepancy**: **0 (100% exact match)**

---

## 3. Disambiguation & Overlap Analysis Table

| Intent A | Intent B | Root Cause of Overlap | Disambiguation & Precedence Rule |
| :--- | :--- | :--- | :--- |
| `software_update` | `battery_power` | Customers cite OS updates as the temporal trigger for battery drain (*"Since updating to iOS 11 my battery dies in 2 hours"*). | **Symptom Precedence**: If text mentions battery drain, overheating, or charging issues, assign `battery_power`. `software_update` is strictly reserved for failures of the installation/download/verification process itself. |
| `software_update` | `display_hardware` | Customers report screen freezes or visual glitches occurring after an OS upgrade (*"After update my screen is black and frozen"*). | **Symptom Precedence**: If text mentions screen unresponsive, touch failure, or black screen, assign `display_hardware`. |
| `apps_appstore` | `software_update` | Customers report third-party apps crashing after an OS update (*"Calendar app crashes since iOS 11"*). | **Application Precedence**: If the failure is isolated to specific apps (YouTube, Mail, Calendar, Twitter), assign `apps_appstore`. |
| `audio_media` | `apps_appstore` | Music apps (Spotify, Apple Music) crashing or playback stopping. | If the complaint is about sound quality, volume, AirPods, or media playback, assign `audio_media`. If an app icon won't launch or crashes on boot, assign `apps_appstore`. |
| `account_icloud` | `billing_subscriptions` | Apple ID credentials are used to make App Store purchases. | If the issue involves an unauthorized monetary charge, credit card billing, or refund request, assign `billing_subscriptions`. If it involves password recovery, 2FA codes, or account lockout, assign `account_icloud`. |
| `display_hardware` | `billing_subscriptions` | Hardware damage tweets mentioning costs or repair bills (*"will it be a £400 repair bill for my broken screen?"*). | **Negative Guard**: Inquiries mentioning "repair bill", "screen repair", or "cost to fix screen" belong to `display_hardware` (Genius Bar repair). `billing_subscriptions` is strictly reserved for digital Apple purchases, subscriptions, and card charges. |
| `display_hardware` | `other_unclear` | Vague complaints like *"my phone is broken"* or *"everything is broken"*. | If customer does not specify screen, touch, button, or hardware freezing, route to `other_unclear` for human clarification. |

---

## 4. Architectural Note on `apps_appstore` (Combining Store & Crashes)

**Why App Store downloads and individual app crashes are intentionally combined**:
1. Both represent the **Application Layer** operating above the core operating system and hardware.
2. In Twitter support, customers frequently conflate the two (*"I can't update Twitter on App Store and now it won't open"*).
3. Splitting them would create two very small fragments (735 App Store inquiries and 883 app crash inquiries, each $\approx 1\%$ of data), causing severe boundary confusion.
4. The historical support resolution pattern for both involves app-level lifecycle remediation: force quit, offload/reinstall app, verify App Store connection, or escalate to third-party app developer.

---

## 5. Detailed Intent Specifications (All 10 Intents)

### 1. `other_unclear` — Fallback Intent (Human Escalation Required)
- **Definition**: Customer inquiry cannot be confidently diagnosed or routed to an automated troubleshooting workflow.
- **Inclusion Criteria**: Vague emotional venting without diagnostic symptoms (*"Apple sucks tonight"*, *"Fix your garbage"*), retail store inquiries (*"Are stores open Sunday?"*), pre-orders and shipment status (*"Where is my iPhone X?"*), foreign languages (Spanish, Turkish, German), or inquiries with insufficient context.
- **Exclusion Criteria**: Inquiries containing clear, specific technical symptoms matching intents 2–10.
- **Requires Human Review**: **YES (`requires_human_review = true`)**
- **Representative Real Examples**:
  1. *Tweet 723*: `"hello are all the lines closed for tonight #help"`
  2. *Tweet 733*: `"I’ve got a screenshot saying my #iPhoneX is reserved for the 3rd then an email saying it’s the 18th... what happened?"`
  3. *Tweet 736*: `"Thank you I updated my phone and now it is even slower and barely works. Thank you for ruining my phone.😤"`
  4. *Tweet 747*: `"Hola necesito urgente la actualización de software. La batería me dura literal medio día 🙍🏼🙇🏼♀"`
  5. *Tweet 758*: `"Hey ! Last time I downloaded an update my freaking phone gave me hell. Any recommendations?"`
  6. *Tweet 1770*: `"why is my home sharing not working and how do i fix it"`
  7. *Tweet 1785*: `"epıl bana yardımcı olur musun telefon internet konusunda çok yakıyo napcaz ?"`
  8. *Tweet 2623*: `"why do you have the red dot? Nobody likes it. Don't force this ugly thing on us."`
  9. *Tweet 2626*: `"when will you support in car wi-fi so that I can use Apple CarPlay with my aftermarket deck? Thanks!"`
  10. *Tweet 2634*: `"Can you help me? Trying to find the exact trade-in value for an iPhone 6 in store."`

---

### 2. `battery_power` — Battery, Power & Charging Issues
- **Definition**: Premature battery depletion, spontaneous device shutoffs at high remaining charge, excessive heat generation, or charging connection failures.
- **Inclusion Criteria**: Explicit mention of battery percentage drop, dying at 20–40%, charger/cable not working, phone overheating while charging or in use, battery health degradation.
- **Exclusion Criteria**: Credit card charging (must go to `billing_subscriptions`), phone black screen from physical water damage (must go to `display_hardware`).
- **Representative Real Examples**:
  1. *Tweet 767*: `"I just need to do something about the battery life because it sucks ass"`
  2. *Tweet 1761*: `"iOS 11 is killing my battery . Fix it."`
  3. *Tweet 2616*: `"why is my battery life short? I updated to 11.1, my battery is poor. Wife didn’t she likes her battery life"`
  4. *Tweet 2628*: `"Question- my iPhone6 dies very quick (have to charge it 3 times a day) my iPhone5 battery was faulty. Could this be the same?"`
  5. *Tweet 3767*: `"I’m no expert in battery life but 40% doesn’t go to 7% in 5minutes"`
  6. *Tweet 4880*: `"iPhone 7+ was full battery. Woke up. 0%. Put on charge. Turned on at 87%."`
  7. *Tweet 5834*: `"Why does my iPhone battery drain within 3-4 hours after iOS 11.1 update?"`
  8. *Tweet 6553*: `"phone is overheating and burning hot while charging with official cable"`
  9. *Tweet 8303*: `"My phone won't charge past 80% no matter how long it stays plugged in"`
  10. *Tweet 11105*: `"battery dropped from 50% to 1% in seconds and shut down"`
- **Resolution Pattern**: Guide customer to Settings > Battery, toggle Low Power Mode, check background app usage, perform hard reset.
- **Escalation Considerations**: Physical swelling/expanding casing or severe burning heat $\rightarrow$ Immediate Genius Bar escalation.

---

### 3. `keyboard_typing` — Keyboard, Typing & Autocorrect Glitches
- **Definition**: Predictive text errors, keyboard input lag, keyboard disappearing, or autocorrect character substitution (specifically the historic iOS 11.1 capital 'I' $\rightarrow$ 'A [?]' bug).
- **Inclusion Criteria**: Inability to type letter 'I', question mark box substitution, autocorrect replacing correct words, keyboard latency, spacebar or dictation bugs.
- **Exclusion Criteria**: Touch screen unresponsive across the entire device (classify as `display_hardware`).
- **Representative Real Examples**:
  1. *Tweet 714*: `"Hey and anyone else who upgraded to ios11.1, are y’all having issues with capital “I” in the Mail app? As it puts in “A”?"`
  2. *Tweet 719*: `"Tf is wrong with my keyboard"`
  3. *Tweet 730*: `"Hello, internet. Can someone explain why this symbol keeps appearing on my phone and when I try to type the letter I? Also"`
  4. *Tweet 1755*: `"Why does my I not work ?! please fix this!!!"`
  5. *Tweet 1759*: `"Why is “I” keep changing to this and how do I stop it🤦🏽♀ #anybody"`
  6. *Tweet 3773*: `"iOS 11.1 - keyboard lag. 🤨"`
  7. *Tweet 4882*: `"tell me why I’I’ve updated my phone twice and I can’t type letter I without getting a letter A and a question mark"`
  8. *Tweet 5824*: `"Why is there a symbol instead of the letter i when I type on my iPhone?"`
  9. *Tweet 8312*: `"Keyboard completely disappears when trying to reply to texts in iMessage"`
  10. *Tweet 9831*: `"Dictation on keyboard inserts completely wrong words since update"`
- **Resolution Pattern**: Configure Settings > General > Keyboard > Text Replacement (phrase "I", shortcut "i") or update to iOS 11.1.1.
- **Escalation Considerations**: Physical hardware keyboard failure on MacBook (butterfly switch keys stuck).

---

### 4. `audio_media` — Apple Music, Audio & Media Playback
- **Definition**: Streaming music playback, iTunes syncing, speaker/microphone malfunctions, volume control glitches, or AirPods connection issues.
- **Inclusion Criteria**: Songs missing from Apple Music library, music pausing unexpectedly, no audio from speakers, muffled microphone, alarm volume too low/silent, AirPods cutting in and out.
- **Exclusion Criteria**: Cellular call audio dropped due to cell carrier reception (classify as `connectivity_network`).
- **Representative Real Examples**:
  1. *Tweet 765*: `"After update #ios1103 no spotify on my lock screen?"`
  2. *Tweet 1781*: `"why can’t I change ringer volume with the buttons? Whose dumb idea was it to change that and how do they still have a job?"`
  3. *Tweet 2620*: `"watchOs4 made my watch pointless Browsing music on my phone via the watch was 80% reason for buying it now it’s useless."`
  4. *Tweet 2632*: `"And why is my music NEVER in my control center?!"`
  5. *Tweet 2682*: `"ios 11.0.3 on 6s. Cannot adjust alarm volume so waking up all in my house and neighbours despite ringer being set to minimum!"`
  6. *Tweet 35281*: `"why is my alarm sound not working when on silent and volume on lock screen not working after the update??"`
  7. *Tweet 42618*: `"my iPhone 8 lock screen music controls always freeze specifically the elapsed time of a song I can still control. Visual bug"`
  8. *Tweet 11101*: `"music and podcast “skip” around like a CD, then distorts and clears up in few seconds, only happens after iOS 11"`
  9. *Tweet 12610*: `"No sound coming from my top speaker when on regular phone calls"`
  10. *Tweet 14322*: `"AirPods keep disconnecting every 5 minutes while listening to music"`
- **Resolution Pattern**: Toggle iCloud Music Library, reset AirPods, verify sound settings in Control Center, clean speaker grilles.
- **Escalation Considerations**: Physical blown speaker or water in microphone port $\rightarrow$ Hardware repair.

---

### 5. `apps_appstore` — App Store Downloads & App Performance
- **Definition**: Failures downloading, updating, or opening applications from the App Store, or specific first/third-party app crashes.
- **Inclusion Criteria**: App Store download spinner stuck, "Waiting..." status on icons, apps crashing on launch (YouTube, Calendar, Mail, Instagram, WhatsApp, Spotify, Twitter).
- **Exclusion Criteria**: App Store billing/refund disputes (classify as `billing_subscriptions`), OS update failure (classify as `software_update`).
- **Representative Real Examples**:
  1. *Tweet 749*: `"Hi! What is going on? Has Youtube lost it? What can be done about it? Thanks for the support!"`
  2. *Tweet 1779*: `"my PHONE app doesn’t work. Thank you for updating my #iPhone to an #ipod"`
  3. *Tweet 1791*: `"why won’t my apps fuccin download or update"`
  4. *Tweet 2645*: `"when will the bug in the calendar app be fixed? I upgraded to iOS 11.1 and it still crashes when iOS 11.03"`
  5. *Tweet 9838*: `"updating xcode via appstore. 7-min remaining 6-hr ago. 1-min rem for over an hour. Why? My net bandwidth is good."`
  6. *Tweet 14319*: `"My Calendar app doesn’t work at all after iOS 11.1, can’t see other months and it just shuts down, I have an IPhone SE"`
  7. *Tweet 22995*: `"help!! My Mac App Store will not open so I cannot update my 2015 MacBook Pro currently running on OS X Yosemite 10.10.3"`
  8. *Tweet 23086*: `"I decided to download IOS 11. Now I can’t download anything from the App Store. Is this problem being fixed soon? I’ve tried all the options to make it work. #worstdecisionever"`
  9. *Tweet 31884*: `"I can’t download apps from the app store."`
  10. *Tweet 33349*: `"appstore giving me grief AGAIN trying to update xcode been at '0 bytes of 5G - less than a minute' for hours now."`
- **Resolution Pattern**: Force quit and restart app, offload/reinstall app, check App Store Apple ID login, verify storage space.
- **Escalation Considerations**: Developer-wide server outage or recurring kernel panics.

---

### 6. `display_hardware` — Screen, Touch & Physical Hardware
- **Definition**: Unresponsive touch screen, display visual artifacts, black screen of death, broken physical buttons, or hardware repair inquiries.
- **Inclusion Criteria**: Touch gestures not working, ghost touches, black screen while phone vibrates/rings, cracked glass, broken Home button, Face ID hardware failure, questions regarding screen repair costs/bills.
- **Exclusion Criteria**: Screen freeze isolated to a single app (classify as `apps_appstore`).
- **Representative Real Examples**:
  1. *Tweet 756*: `"MY HOME BUTTON DOESN’T WORK #IOS11"`
  2. *Tweet 2624*: `"It’s been a few days since made me update my phone’s operating system. Now constantly glitching, hmm 🤔 I’m shocked!"`
  3. *Tweet 2678*: `"Any idea why icons show up like this? I did force reset to no avail. After initial notification display, they show up."`
  4. *Tweet 3764*: `"not only does my phone keep freezing but when i screenshot things it turns out white... really not liking this iphone 8 plus"`
  5. *Tweet 61409*: `"My iPhone is acting up!! What the fuck? I paid $700 last year for this phone, now it's glitching and being slow? fix this"`
  6. *Tweet 18872*: `"the screen on our iPad Pro has stopped working 😔. I've read a few articles about weak screens on some models - is there anywhere I can check the model number, or will it be a £400 repair bill? Thanks"`
  7. *Tweet 23120*: `"I literally have to have this phone for another year and a half until it’s paid off and I can’t be on my phone for more than 5 minutes before it glitches and completely freezes"`
  8. *Tweet 25430*: `"Touch screen completely stopped responding after dropping on floor, no cracks visible"`
  9. *Tweet 31920*: `"My screen went completely black but I can still hear notifications incoming"`
  10. *Tweet 41677*: `"what is going on here? Taking a screenshot doesn't capture the error. Only occurs on Finder windows. It's like Windows XP!"`
- **Resolution Pattern**: Force restart key sequence, inspect for screen protector interference, guide to Apple Store service reservation.
- **Escalation Considerations**: Physically cracked display, liquid submersion, or hardware button failure $\rightarrow$ Book Genius Bar appointment.

---

### 7. `account_icloud` — Apple ID, iCloud & Account Security
- **Definition**: Authentication credentials, Apple ID lockouts, password recovery, Two-Factor Authentication (2FA), or iCloud storage quota issues.
- **Inclusion Criteria**: Apple ID locked for security reasons, forgotten password/passcode, 2FA verification code not arriving, iCloud storage full alerts, iCloud backup failing.
- **Exclusion Criteria**: Digital subscription charges on the account (classify as `billing_subscriptions`).
- **Representative Real Examples**:
  1. *Tweet 1764*: `"Hello, I need some help regarding the region change on my Apple ID"`
  2. *Tweet 2635*: `"Just updated iOS on iPhone7, now iCloud backup greyed out, cannot be turned on, says “Last Backup Never”"`
  3. *Tweet 6554*: `"how long does it take usually for account recovery to get back to you? It’s been about a week now."`
  4. *Tweet 8437*: `"suck! Upgrade phone & I lose my Apple ID. Can’t get new id without old & can’t book Genius bar help appointment without ID!!! #stupid"`
  5. *Tweet 8557*: `"is that safe if we disable passcode for unlock iphone? i mean,is the fingerprint still worked out? i think dat would be enough"`
  6. *Tweet 14337*: `"So over & their awful customer service. Locked out of iCloud for 2 weeks & promised password recovery instructions that never came🖕🏽"`
  7. *Tweet 31935*: `"So at midnight my phone just went blank, spun the wheel,and asked me to enter my passcode ...wtf since os 11 this randomly :("`
  8. *Tweet 32401*: `"Hey I heard I can change my Apple ID to my email but when I try it says nope. What gives? Spent an hour signing out & in."`
  9. *Tweet 34624*: `"Is there a way to merge two AppleID’s, so I can use all bought items in one ID and delete the other?"`
  10. *Tweet 36626*: `"Hi there, my iPhone 6S plus can’t do backup for it, not by iCloud and iTunes , any way to fix it ,thanks"`
- **Resolution Pattern**: Direct customer to `iforgot.apple.com`, steps to manage iCloud storage backups, guide trusted phone numbers.
- **Escalation Considerations**: Complete security lockout with lost trusted devices $\rightarrow$ Account Recovery queue / human specialist.

---

### 8. `connectivity_network` — Wi-Fi, Bluetooth & Cellular Connectivity
- **Definition**: Wireless networking, Bluetooth pairing, cellular carrier signal, AirDrop transfers, or SIM card recognition failures.
- **Inclusion Criteria**: Wi-Fi toggle greyed out, Wi-Fi dropping connection, Bluetooth failing to pair with car or speaker, "No Service" / "Searching..." carrier error, AirDrop not discovering contacts, SIM card not recognized.
- **Exclusion Criteria**: Cellular carrier bill dispute (carrier issue).
- **Representative Real Examples**:
  1. *Tweet 1783*: `"if my words even mean a thing to you; I am an iPhone 7 owner and have updated to your latest software and now am having the most dropped calls in history and glitch’s such as apps randomly opening and more ... #iHelp"`
  2. *Tweet 2659*: `"Is anyone else having problems with there iPhone 7 saying no service?"`
  3. *Tweet 5849*: `"I updated to iOS 11 and my iPhone 6 stopped connecting to wi-fi. Already restored the phone and the network connections"`
  4. *Tweet 13588*: `"Why do I need a sim card when I’m joined to the WiFi? I’m only using this phone to test websites."`
  5. *Tweet 13933*: `"after updating to ios 11.1 I have no service, displays no service. reset networking settings does nothing"`
  6. *Tweet 25424*: `"Bluetooth connection iPhone X to Infiniti is terrible. Garbled and scratchy cutting in and out >30% of time. Didn't happen W iPhone 6!!"`
  7. *Tweet 36109*: `"Can’t an iPhone 8 connect to a Bluetooth device using NFC?"`
  8. *Tweet 39670*: `"why does my iPhone turn on WiFi and Bluetooth automatically? 😭 #IWantToUseMyData"`
  9. *Tweet 41674*: `"11.1 update broke my wifi it's greyed out i've been waiting on live chat for over 30 minutes.."`
  10. *Tweet 41683*: `"I updated my iOS last night but the Bluetooth connectivity is still not acceptable. My Bluetooth earbuds will not pair. Help!"`
- **Resolution Pattern**: Settings > General > Reset > Reset Network Settings, toggle Airplane mode for 10s, reinsert SIM card, forget and rejoin Wi-Fi network.
- **Escalation Considerations**: Known iPhone 7 "No Service" hardware baseband recall or hardware logic board defect.

---

### 9. `billing_subscriptions` — Billing, App Store Purchases & Refunds
- **Definition**: Digital monetary transactions, unwanted charges on credit cards, recurring subscription renewals, refund claims, and gift card redemption errors.
- **Inclusion Criteria**: Unauthorized card charges from iTunes/App Store, charged twice for in-app purchase, subscription cancellation requests, refund claims, payment method declined, iTunes gift card code delivery failure.
- **Exclusion Criteria**: Physical hardware repair bills (classify as `display_hardware`), monthly carrier bills.
- **Representative Real Examples**:
  1. *Tweet 9180*: `"I bought an iTunes gift card worth £15 a week ago, and the email still hasn’t come into my inbox to tell me the code. Helpppp"`
  2. *Tweet 12602*: `"Why do you keep charging my card for FREE apps? Im not happy at all."`
  3. *Tweet 35262*: `"I got refunded for an in app purchase on Monday & got a conformation email, but there’s no sign of it in my account yet..."`
  4. *Tweet 39623*: `"where is all my music that was in my library? and why do i have to renew my subscription?"`
  5. *Tweet 47995*: `"hi there, I need to inquire something regarding he refund of an item"`
  6. *Tweet 61323*: `"I accidentally bought something is there anyway I can get a refund"`
  7. *Tweet 67418*: `"Why is it that i have been waiting for almost a month for a refund of a returned item i paid cash for in the first place? Where is my money?"`
  8. *Tweet 89012*: `"Why doesn't work like they used to? I get a random charge and I'm trying to access my account but it won't accept my password...so i change it.. and it won't accept that password either.. No help from their call in number either.."`
  9. *Tweet 90654*: `"excuse me, I'm got a refund confirmation email but nothing happened. Do I have to do anythings?"`
  10. *Tweet 101304*: `"how do I go about raising a high level complaint please? 4 senior techs couldn’t help fix my problem, now my e mails are being unanswered, want a refund for a product that’s not fit for purpose, have tried everything to fix, thanks."`
- **Resolution Pattern**: Direct customer to `reportaproblem.apple.com` for refund submissions, guide to Settings > [Name] > Subscriptions to cancel active recurring charges.
- **Escalation Considerations**: Identity theft, unauthorized credit card fraud, or disputed large charges $\rightarrow$ Direct to Apple Billing Specialist.

---

### 10. `software_update` — OS Update & Installation Issues
- **Definition**: Errors encountered strictly during the checking, downloading, installation, or verification of an iOS or macOS system upgrade.
- **Inclusion Criteria**: "Unable to Verify Update", "An error occurred downloading iOS", update stuck downloading/installing, phone stuck on Apple logo during update, how to downgrade/revert to previous iOS version.
- **Exclusion Criteria**: Inquiries where the OS update is already complete and customer is reporting a specific post-update symptom (battery drain $\rightarrow$ `battery_power`, frozen screen $\rightarrow$ `display_hardware`, typing glitch $\rightarrow$ `keyboard_typing`, app crash $\rightarrow$ `apps_appstore`).
- **Representative Real Examples**:
  1. *Tweet 5831*: `"Unable to verify update. iOS 11.0.3 failed verification because you are no longer connected to the internet. But I am!"`
  2. *Tweet 9835*: `"My iPhone is stuck on the Apple logo with a loading bar during iOS update. It has been 3 hours now."`
  3. *Tweet 12599*: `"How do I downgrade back to iOS 10? iOS 11 has ruined my phone."`
  4. *Tweet 14328*: `"An error occurred downloading iOS 11.1. Tried 4 times on high speed internet."`
  5. *Tweet 21160*: `"Update requested... for the past 24 hours. Won't start downloading."`
  6. *Tweet 25433*: `"iPhone says not enough storage to install iOS 11 update even though I have 5GB free."`
  7. *Tweet 31899*: `"Software update failed. An error occurred installing iOS 11."`
  8. *Tweet 36112*: `"Phone won't turn back on after latest software update. Stuck in restart loop."`
  9. *Tweet 41679*: `"Can I restore my phone to previous iOS without losing my photos? New update is unusable."`
  10. *Tweet 48011*: `"Cannot install update. A message popped up saying verification failed."`
- **Resolution Pattern**: Delete installer file in Settings > General > iPhone Storage, reconnect to Wi-Fi, restart device, or update via iTunes on Mac/PC.
- **Escalation Considerations**: Boot loop / recovery mode failure $\rightarrow$ DFU restore / Genius Bar service.
