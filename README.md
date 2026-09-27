# RP Exchange Simulation

Expo React Native Android demo application for demonstrating an exchange-style interface without real-money or crypto settlement.

## Simulation boundaries
- All balances are simulated values.
- Buy/sell activity creates simulated transaction records only.
- No wallet, private-key, crypto custody, payment collection, or asset settlement is implemented.
- No deposit-linked referral, team, or rebate payout system is included.
- Maintenance Mode is a transparent user-facing state.
- The calculator is a standalone utility and is not a hidden application mode.

## Stack
- Expo SDK 54
- React Native 0.81
- Firebase Authentication / Firestore / Functions
- Expo Updates

## Local setup
1. Configure Firebase Authentication and Firestore.
2. Configure the EXPO_PUBLIC_FIREBASE_* environment variables.
3. Run npm install.
4. Run npx expo start.

## Security
Do not commit service-account JSON, signing keys, private wallet keys, or API secrets. Admin operations are restricted to the configured admin UID and server-side Functions.

## Build
Use the repository Android workflow or an Expo/EAS Android build with appropriate signing credentials. A new native build is required when native dependencies or Expo runtime configuration changes.
