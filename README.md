# ExpensiU 📱

**ExpensiU** is a privacy-first, offline AI-powered personal finance tracker that automatically monitors and categorizes your transactions across multiple currencies. Built with native Android/iOS support and local LLM inference, it gives you complete control over your financial data while delivering intelligent insights without ever sending your information to the cloud.

---

## What It Is

ExpensiU is a secure mobile application that automatically parses SMS notifications and device notifications to track bank transactions, providing real-time budget monitoring with AI-powered transaction classification, multi-currency support, and actionable financial alerts delivered via smart push notifications.

The app uses a hybrid parsing architecture:
1. **Regex-based detection** for immediate results on clear transaction messages
2. **Local LLM inference** (Qwen 0.5B) as fallback for ambiguous cases
3. All processing happens **on-device** with zero cloud dependency for sensitive data

### Key Capabilities
- 🔄 **Automatic SMS parsing** - Reads SMS notifications from your bank/app providers
- 💰 **Multi-currency support** - Handles USD, EUR, GBP, INR, JPY, SAR, and 50+ more
- 🤖 **On-device AI classification** - Local LLM for transaction categorization without cloud dependency
- 🔔 **Smart notifications** - Context-aware alerts based on spending patterns and budget limits
- 🔒 **End-to-end encryption** - SQLite with disk encryption and biometric authentication
- ⚡ **Offline-first design** - All core features work without internet connection

---

## Key Features

### 🎯 Smart Transaction Parsing
- Extracts amounts, merchants, and categories from SMS notifications in real-time
- Supports global number formats (US, European, space-separated, Arabic numerals)
- Automatically detects currency symbols and ISO codes
- Filters out spam/OTP messages to avoid false positives

### 🧠 Local AI Processing
- On-device LLM inference using `llama.rn` with Qwen 2.5-0.5B model (~300MB)
- Classifies transactions into 10 categories: Food, Transport, Shopping, Entertainment, Health, Utilities, Transfer, Salary, Refund, Other
- Generates personalized notifications based on spending behavior

### 💸 Multi-Currency Support
| Currency | Symbol | Code |
|----------|--------|------|
| US Dollar | $ | USD |
| Euro | € | EUR |
| British Pound | £ | GBP |
| Indian Rupee | ₹ | INR |
| Japanese Yen | ¥ | JPY |
| UAE Dirham | ﷼ | SAR |
| Qatar Riyal | ﷼ | QAR |
| South African Rand | R | ZAR |
| And 40+ more | ... | ... |

### 🔔 Intelligent Notifications
- **Daily** summary at 7 PM (if ≥3 transactions that day)
- **Weekly** review every Sunday evening
- **Monthly** check-in on the 1st of each month
- Tone-adaptive messaging: "winning" → 👍, "critical" → 🚨

### 🔐 Privacy-First Security
| Feature | Implementation |
|---------|---------------|
| **Database encryption** | SQLite with key-based encryption (`.expensiu/` hidden folder) |
| **Biometric lock** | Face ID/Fingerprint authentication on app launch |
| **Secure storage** | iOS Secure Enclave, Android Keystore for credentials |
| **Zero-cloud AI** | All LLM inference happens locally on device |
| **Automatic data wipe** | Military-grade secure deletion with SQLite `VACUUM` |

### 🌍 Global Locale Support
- Detects and parses: US English (1,234.56), European (1.234,56), Indian (१,२३४.५६)
- Supports Arabic/Urdu text with native numeral system detection
- 10+ locale configurations for regional preferences

---

## Tech Stack

### Frontend
| Package | Purpose |
|---------|---------|
| Expo SDK | Cross-platform mobile framework |
| React Native | Native UI components |
| expo-router | File-based navigation |
| expo-secure-store | Encrypted credential storage |
| expo-local-authentication | Biometric/Face ID auth |
| expo-notifications | Smart push notification scheduling |

### Backend (Local)
| Package | Purpose |
|---------|---------|
| expo-sqlite | Encrypted local database |
| llama.rn | ONNX Runtime for LLM inference |
| date-fns | Date/time utilities |

### Native Modules
| Component | Implementation |
|-----------|---------------|
| Android SMS Listener | @flyerhq/react-native-android-sms-listener (native C++ via CMake) |
| Model Manager | C++ native module for LLM initialization |

### Machine Learning
| Framework | Usage |
|-----------|-------|
| llama.cpp | ONNX Runtime inference engine |
| Qwen 2.5-0.5B-instruct | Local transaction classification model |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         ExpensiU App                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │   SMS        │  │ Notification │  │    AI Engine           │ │
│  │   Listener   │←→│   Scheduler  │←→│    (llama.rn)          │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬────────────┘ │
│         │                 │                      │              │
│         ▼                 ▼                      ▼              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    SQLite Database                         │ │
│  │    ┌────────────┐   ┌────────────┐   ┌───────────────────┐ │ │
│  │    │transactions│   │user_profile│   │daily_summary_cache│ │
│  │    └────────────┘   └────────────┘   └───────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│         ▲                       ▲                               │
│         │                       │                               │
│ ┌───────┴───────────────────────┴────────────────────────────┐  │
│ │              Security Layer                                │  │
│ │    ┌───────────────┐    ┌─────────────────────────────┐    │  │
│ │    │ Biometric Auth│    │ Encryption Key (SecureStore)│    │  │
│ │    └───────────────┘    └─────────────────────────────┘    │  │
│ └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        AI Model Storage                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │.expensiu/models/llama.rn/qwen2.5-0.5b-instruct-q4_k_m.gguf│  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

Data Flow:
1. SMS/Notification → parseSMS() (regex/currency detector)
2. High confidence → DB insert; Low confidence → AI fallback
3. AI enhanceTransaction() enriches merchant/category
4. daily_summary_cache aggregated via pure SQL
5. Smart notifications based on spending thresholds
```

### Module Architecture
```
src/
├── android/           # Native C++ SMS parsing module
├── services/          # Core business logic
│   ├── smsParser.ts        # Transaction extraction
│   ├── aiEngine.ts         # LLM inference wrapper
│   ├── currencyDetector.ts # Multi-format number handling
│   ├── notificationEngine.ts  # Smart alert scheduling
│   ├── statementImporter.ts # CSV/XLSX batch import
│   └── deduplicator.ts     # Prevent duplicate entries
├── db/               # SQLite operations & schema
├── constants/        # Currency keywords & mappings
└── types/            # TypeScript definitions
```

---

## Screenshots

> *[Add screenshots here after building the app]*

```
┌─────────────────────────────────────┐
│           ExpensiU UI               │
├─────────────────────────────────────┤
│                                     │
│    [ Home Screen ]                  │
│    Recent transactions list         │
│                                     │
│    [ Summary View ]                 │
│    Weekly/Monthly breakdown chart   │
│                                     │
│    [ Settings ]                     │
│    Budget limits, locale config     │
│                                     │
└─────────────────────────────────────┘
```

*After building the app with `expo run:android` or `expo run:ios`, add actual screenshots to this section.*

---

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm/yarn
- Android Studio / Xcode (for native development)
- ~300MB free space for AI model download (one-time, WiFi required)

### Quick Start

```bash
# Clone the repository
git clone <repo-url>
cd expensiu

# Install dependencies
npm install

# Initialize database (creates .expensiu folder with encrypted DB)
npx expo-doctor  # Verify setup

# Build and run on Android
npm run android

# Or build for iOS (requires Xcode/Mac)
npm run ios

# Or build for web (for testing UI)
npm run web
```

### First-Time Configuration
1. **First Launch**: Biometric enrollment or PIN setup required
2. **AI Model Download**: Connect to WiFi, first AI inference will auto-download Qwen model (~300MB)
3. **Budget Setup**: Set monthly budget in Settings → Profile
4. **SMS Listener (Android)**: Grant SMS access permissions in app settings

### Building for Production
```bash
# Android debug build
npm run android

# Android release build (requires keystore setup)
npx expo export --platform android

# iOS development build
npm run ios
```

---

## Privacy Guarantee 🔒

ExpensiU is built on **zero-cloud** principles:

### What We DON'T Do
- ❌ Never upload your transaction data to any server
- ❌ Never send SMS content to external APIs
- ❌ No telemetry or analytics enabled by default
- ❌ No third-party SDKs that track user behavior

### What We DO Do
- ✅ All AI inference happens locally using `llama.rn` (ONNX Runtime)
- ✅ Database encrypted with random key stored in SecureStore/Secure Enclave
- ✅ SQLite encryption mode for disk-level protection
- ✅ Biometric authentication on app launch (Face ID/Fingerprint)
- ✅ Automatic data wipe function for complete deletion

### Security Architecture
```
┌──────────────────────────────────────────────────────────────┐
│                    Secure Storage Layers                     │
├──────────────────────────────────────────────────────────────┤
│  Layer 1: SQLite (file-based encryption)                     │
│         └─ Key stored in:                                    │
│            ├─ iOS: Secure Enclave / Keychain                 │
│            └─ Android: Keystore System                       │
├──────────────────────────────────────────────────────────────┤
│  Layer 2: SecureStore (encrypted key-value)                  │
│         └─ Random UUID key regenerated on each wipe          │
├──────────────────────────────────────────────────────────────┤
│  Layer 3: Biometric Authentication                           │
│         └─ Face ID / Fingerprint required for access         │
└──────────────────────────────────────────────────────────────┘
```

### Third-Party Dependencies Audit
All dependencies are actively maintained Expo/RN packages with no known vulnerabilities. See `package.json` for full dependency tree. For enterprise deployments, run:
```bash
npm audit --production
```

---

## Roadmap

### v1.0 (Current) - Foundation
- [x] SMS parsing with regex + AI fallback
- [x] Multi-currency detection (50+ currencies)
- [x] Local LLM inference via llama.rn
- [x] Smart notification scheduling
- [x] Biometric authentication
- [ ] Database encryption production hardening
- [ ] Offline-first optimizations

### v1.1 - Enhanced Intelligence
- [ ] ML-based merchant recognition (no AI calls)
- [ ] Category confidence scores with user feedback loop
- [ ] Transaction photo scanning via device camera
- [ ] CSV/XLSX batch import enhancement

### v1.2 - Social Features
- [ ] Household expense sharing (encrypted peer-to-peer)
- [ ] Anonymous spending trends across demographics
- [ ] Community budget templates (opt-in)

### v2.0 - Expansion Targets
- [ ] iOS full SMS access support (sandbox API)
- [ ] WearOS companion app for quick transactions
- [ ] Enterprise edition with MDM integration

---

## Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Workflow
```bash
# Install dependencies
npm install

# Start Metro bundler
npm start

# Open in Android Studio/Xcode for native development
cd android && ./gradlew :app:assembleDebug  # Or Xcode project open
```

---

## License

MIT License - See [LICENSE](LICENSE) file for details.

ExpensiU is provided as-is for personal finance tracking. Not a substitute for professional financial advice.

---

## Acknowledgments

- **llama.cpp** team for the ONNX Runtime inference engine
- **Expo** for cross-platform mobile framework
- **Qwen AI** for the open-weights model (Apache 2.0)
- **SQLite** for robust encrypted local storage

---

## Contact & Support

- Issues: Create a GitHub issue in this repository
- Feature requests: [Link to issues]
- Privacy questions: See `services/securityService.ts` implementation notes

---

*ExpensiU — Your finances, your privacy, always.*
