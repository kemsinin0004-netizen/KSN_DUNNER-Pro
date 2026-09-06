# SkillNext AI Data Entry — Telegram Bot Guide

SkillNext AI Data Entry គឺជា Expo/React Native application សម្រាប់ភ្ជាប់ Telegram Bot, ផ្ញើសារ, ទទួលសារ, បង្ហាញសារ​ក្នុង Inbox និងគ្រប់គ្រងសារតាម Local Notification។ ឯកសារនេះពន្យល់ពីការដំឡើង ការកំណត់ Telegram Bot ការសាកល្បង និងការបង្កើត Android APK។

> **សេចក្តីសំខាន់:** ការទទួលសារនៅផ្ទៃខាងក្រោយប្រើ Android Background Task ដែលជាប្រព័ន្ធ best-effort។ Android អាចពន្យារពេលដំណើរការ ហើយមិនធានា real-time ឬការដំណើរការបន្ទាប់ពីអ្នកចុច Force Stop។

## 1. តម្រូវការជាមុន

ត្រូវមានកម្មវិធី និងគណនីខាងក្រោម៖

| ឧបករណ៍ | តម្រូវការ |
| --- | --- |
| Node.js | Version 22 ឬ compatible version |
| pnpm | Version 9.12.0 តាម `package.json` |
| Java | JDK 17 សម្រាប់ Android build |
| Android SDK | Platform 35 និង Build Tools 35.0.0 សម្រាប់ GitHub Actions workflow |
| Android device | ត្រូវប្រើ physical device ដើម្បីសាកល្បង notification actions និង background task បានជាក់ស្តែង |
| Telegram | គណនី Telegram និង Bot ដែលបង្កើតតាម `@BotFather` |

មុនចាប់ផ្តើម ត្រូវបង្កើត Bot ដោយបើក Telegram ទៅ `@BotFather`, ជ្រើស `/newbot`, កំណត់ឈ្មោះ និង username របស់ Bot។ បន្ទាប់មករក្សា **Bot Token** ជាសម្ងាត់។

## 2. ដំឡើង Project ក្នុងម៉ាស៊ីន Local

Clone ឬបើក Project ហើយដំឡើង dependencies៖

```bash
git clone <repository-url>
cd skillnext-ai-data-entry
pnpm install
```

ពិនិត្យ source code និង configuration មុន build៖

```bash
pnpm check
pnpm lint
pnpm test
```

បើចង់បើក web preview៖

```bash
pnpm dev
```

ឬប្រើ scripts ដែលមាននៅក្នុង Project៖

```bash
pnpm dev:server
pnpm dev:metro
```

## 3. ភ្ជាប់ Telegram Bot ក្នុង App

1. បើក SkillNext app។
2. ចុច **ភ្ជាប់ Bot**។
3. បញ្ចូល Bot Token ពី `@BotFather`។
4. ចុច **ភ្ជាប់ និងផ្ទៀងផ្ទាត់**។
5. App នឹងហៅ Telegram `getMe` ដើម្បីពិនិត្យ Token។
6. បើជោគជ័យ App នឹងបង្ហាញ Bot username ឬ Bot name។

Bot Token ត្រូវបានរក្សាទុកតាម `expo-secure-store` នៅ Android/iOS។ កុំដាក់ Token ក្នុង Git, `.env` ដែល commit ទៅ repository, screenshot, log ឬ GitHub Actions output។

បើចង់ផ្តាច់ Bot សូមចុច **ផ្តាច់**។ វានឹងលុប Token ដែលរក្សាទុកក្នុងឧបករណ៍។

## 4. សាកល្បងផ្ញើសារ

នៅក្នុង Bot panel៖

1. បញ្ចូល **Chat ID**។
2. បញ្ចូលសារសាកល្បង។
3. ចុច **ផ្ញើ Test Message**។

មុនផ្ញើ ត្រូវបើក Chat ជាមួយ Bot នៅ Telegram ហើយចុច `/start` ឬផ្ញើសារមួយទៅ Bot ជាមុនសិន។ បើមិនដូច្នោះទេ Telegram អាចបដិសេធដោយ error ដូចជា `chat not found`។

`Chat ID` អាចជា៖

- User chat ID ដូចជា `123456789`។
- Group chat ID ដែលជាញឹកញាប់មានទម្រង់អវិជ្ជមាន ដូចជា `-1001234567890`។

## 5. សាកល្បងទទួលសារ និង Inbox

ពេល Bot បានភ្ជាប់ App នឹងប្រើ `getUpdates` polling នៅពេល App បើក។ សារដែលមាន text នឹងបង្ហាញនៅក្នុង **សារចូលពី Telegram** ជាមួយព័ត៌មាន៖

| ព័ត៌មាន | អត្ថន័យ |
| --- | --- |
| Sender | ឈ្មោះ ឬ username អ្នកផ្ញើ |
| Chat | ឈ្មោះ chat ឬ chat ID |
| Message | ខ្លឹមសារសារ |
| Status | មិនទាន់អាន, Read ឬ Archived |
| Time | ម៉ោងដែលសារត្រូវបានទទួល |

App ប្រើ Telegram update offset ដើម្បីកុំឲ្យសារដដែលបង្ហាញស្ទួន។ App រក្សាទុក message state ក្នុង local storage ហើយអាចធ្វើការ offline សម្រាប់ការមើលទិន្នន័យដែលបានទទួលរួច។

## 6. បើក Android Background Receiving

នៅក្នុង Bot panel លើ Android៖

1. ចុច **បើកទទួលសារនៅផ្ទៃខាងក្រោយ**។
2. អនុញ្ញាត Notification permission។
3. ទុក App ឲ្យមាន network access និងកុំចុច Force Stop។

Background task ប្រើ `expo-background-task` និង `expo-task-manager`។ វារក្សា update offset និង received messages ក្នុង AsyncStorage។ Android គ្រប់គ្រងពេលដំណើរការពិតប្រាកដ ហើយ minimum interval ត្រូវបានកំណត់ជា 15 នាទី។ វាមិនមែនជា 5-second real-time polling ទេ។

បើចង់បិទ សូមចុច action ដដែលម្តងទៀត។

### លក្ខខណ្ឌដែលត្រូវពិនិត្យ

- Notification permission ត្រូវបានអនុញ្ញាត។
- ឧបករណ៍មាន internet។
- Battery optimization របស់ vendor មិនបានបិទ background work។
- App មិនត្រូវបាន Force Stop។
- Bot មិនត្រូវបានកំណត់ Telegram webhook ដែលប៉ះទង្គិចជាមួយ `getUpdates`។
- ត្រូវប្រើ native Android build ថ្មី។ Web preview និង Expo Go មិនអាចតំណាងឲ្យ behavior របស់ background task ពេញលេញបានទេ។

## 7. គ្រប់គ្រងសារពី Local Notification

ពេលមានសារថ្មី App នឹងបង្កើត Local Notification ដែលមាន Actions៖

| Action | លទ្ធផល |
| --- | --- |
| **តបសារ** | បើក text input ក្នុង Notification ហើយផ្ញើចម្លើយទៅ chat ដើមតាម `sendMessage` |
| **អានរួច** | រក្សា `readAt` របស់សារតាម `updateId` |
| **Archive** | រក្សា `archivedAt` របស់សារតាម `updateId` |

Notification data ត្រូវមាន `updateId` និង `chatId` ដើម្បីឲ្យ Reply ដឹងថាត្រូវផ្ញើទៅ Chat ណា។ ត្រូវ build APK/Development Build ថ្មី ដើម្បីសាកល្បង Notification actions ពេញលេញ។

## 8. បង្កើត Android APK ក្នុងម៉ាស៊ីន Local

បង្កើត native Android project៖

```bash
pnpm exec expo prebuild --platform android --no-install
```

បង្កើត Debug APK៖

```bash
cd android
./gradlew assembleDebug --no-daemon
```

APK នឹងស្ថិតនៅ៖

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

ដំឡើងទៅ Android device ដែលភ្ជាប់ ADB៖

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

បើចង់បើក App ជាមួយ native development command៖

```bash
pnpm android
```

## 9. Build APK ដោយ GitHub Actions

Project មាន workflow នៅ `.github/workflows/android-apk.yml`។ Workflow នឹង៖

1. ប្រើ Ubuntu 24.04, Node.js 22, pnpm 9.12.0 និង Java 17។
2. ដំឡើង Android SDK និង dependencies។
3. រត់ Expo prebuild។
4. រត់ `./gradlew assembleDebug`។
5. Upload APK ជា GitHub Actions artifact។
6. បង្កើត GitHub Release សម្រាប់ push ទៅ `main` ឬ `master`។
7. ផ្ញើ Telegram notification ប្រសិនបើមាន GitHub secrets ត្រឹមត្រូវ។

Push ទៅ branch `main` ឬ `master`៖

```bash
git add .
git commit -m "Build Android APK"
git push origin main
```

បន្ទាប់មកបើក GitHub repository → **Actions** → ជ្រើស **Build Android APK** → ពិនិត្យ workflow run។ APK អាចទាញយកពី **Artifacts** ឬ GitHub Release។

### GitHub Secrets សម្រាប់ Release Notification

បើចង់ឲ្យ workflow ផ្ញើសារទៅ Telegram សូមបង្កើត repository secrets ខាងក្រោម៖

| Secret | តម្លៃ |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Token របស់ Bot ដែលត្រូវផ្ញើ notification |
| `TELEGRAM_CHAT_ID` | Chat ID របស់អ្នកទទួល notification |

កុំដាក់តម្លៃ secrets នៅក្នុង workflow file ឬបោះពុម្ពក្នុង logs។ បើ secrets មិនមាន workflow នឹង skip notification ហើយ APK/Release នៅតែបង្កើតបាន។

## 10. EAS Preview APK ជាជម្រើស

បើមាន EAS account និង authentication អាចប្រើ profile `preview`៖

```bash
npx eas login
npx eas build --platform android --profile preview
```

Profile `preview` ត្រូវបានកំណត់ជា installable APK៖

```json
{
  "android": {
    "buildType": "apk"
  }
}
```

បើមិនប្រើ EAS សូមប្រើ Local Gradle build ឬ GitHub Actions workflow ដែលបានពិពណ៌នាខាងលើ។

## 11. Validation Checklist

មុនប្រគល់ APK ឬ Release សូមរត់៖

```bash
pnpm test
pnpm check
pnpm lint
pnpm exec expo prebuild --platform android --no-install
pnpm exec expo export --platform web
```

បន្ទាប់មកពិនិត្យជំហានសំខាន់ៗលើ physical Android device៖

- ភ្ជាប់ Bot Token ជោគជ័យ។
- ផ្ញើ Test Message ជោគជ័យ។
- ទទួលសារថ្មីចូល Inbox។
- បើក Background Receiving។
- ទទួល Local Notification។
- Reply ពី Notification។
- ចុច Mark as read និងពិនិត្យ Badge ក្នុង Inbox។
- ចុច Archive និងពិនិត្យ Badge ក្នុង Inbox។
- បិទ App ធម្មតា ហើយពិនិត្យថា Background Task អាចត្រូវបានដំណើរការ។

## 12. Troubleshooting

### `Unauthorized` ឬ Token មិនត្រឹមត្រូវ

បង្កើត Token ថ្មីពី `@BotFather` ហើយ copy ទាំងមូលដោយមិនមាន space។ ចុច Disconnect រួចភ្ជាប់ឡើងវិញ។

### `Conflict: terminated by other getUpdates request`

មាន client ឬ service មួយផ្សេងកំពុងប្រើ `getUpdates`។ បិទ polling client ផ្សេង ឬលុប webhook មុនប្រើ App។

### `chat not found`

ពិនិត្យ Chat ID ហើយផ្ញើ `/start` ទៅ Bot ជាមុនសិន។ សម្រាប់ Group ត្រូវបន្ថែម Bot ទៅ Group និងពិនិត្យ privacy setting តាមតម្រូវការ។

### Background task មិនដំណើរការ

ពិនិត្យ permission, network, battery optimization និងការចុះឈ្មោះ task។ Android មិនធានាពេលវេលាដំណើរការជាក់លាក់ ហើយ Force Stop នឹងរារាំង background execution។

### Notification Action មិនបង្ហាញ

ត្រូវបង្កើត native APK/Development Build ថ្មី បន្ទាប់ពីបន្ថែម `expo-notifications` category និង config plugin។ Expo web preview មិនអាចបង្ហាញ Android notification action បានទេ។

### Inbox បង្ហាញសារស្ទួន

កុំ reset update offset នៅគ្រប់ polling cycle។ ត្រូវ persist offset បន្ទាប់ពីទទួល response ជោគជ័យ ហើយបង្កើន offset សម្រាប់ updates ទាំងអស់ ទោះបី update មិនមាន text ក៏ដោយ។

## References

[1]: https://core.telegram.org/bots/api "Telegram Bot API"
[2]: https://docs.expo.dev/versions/latest/sdk/notifications/ "Expo Notifications documentation"
[3]: https://docs.expo.dev/versions/latest/sdk/background-task/ "Expo BackgroundTask documentation"
[4]: https://docs.expo.dev/guides/local-app-production/ "Expo local app production build guide"
[5]: https://docs.expo.dev/build-reference/apk/ "Expo Android APK build reference"
