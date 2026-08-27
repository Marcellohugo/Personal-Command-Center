import Flutter
import Security
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "PersonalCommandCenterSecureStorage")
    let channel = FlutterMethodChannel(
      name: "personal_command_center/secure_storage",
      binaryMessenger: registrar!.messenger()
    )
    channel.setMethodCallHandler { call, result in
      switch call.method {
      case "readPassword":
        result(Self.readPassword())
      case "writePassword":
        guard let password = call.arguments as? String else {
          result(FlutterError(code: "INVALID_PASSWORD", message: "Kata sandi tidak valid.", details: nil))
          return
        }
        if Self.writePassword(password) {
          result(nil)
        } else {
          result(FlutterError(code: "KEYCHAIN_WRITE", message: "Kata sandi tidak dapat disimpan.", details: nil))
        }
      case "deletePassword":
        Self.deletePassword()
        result(nil)
      case "hasAppPin":
        result(Self.readSecret(account: Self.appPinAccount) != nil)
      case "writeAppPin":
        guard let pin = call.arguments as? String else {
          result(FlutterError(code: "INVALID_PIN", message: "PIN tidak valid.", details: nil))
          return
        }
        result(Self.writeSecret(pin, account: Self.appPinAccount))
      case "verifyAppPin":
        guard let pin = call.arguments as? String else {
          result(false)
          return
        }
        result(Self.readSecret(account: Self.appPinAccount) == pin)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
  }

  private static let keychainService = "personal-command-center-sync"
  private static let keychainAccount = "server-password"
  private static let appPinAccount = "app-pin"

  private static func query(account: String) -> [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: keychainService,
      kSecAttrAccount as String: account,
    ]
  }

  private static func readPassword() -> String? {
    readSecret(account: keychainAccount)
  }

  private static func readSecret(account: String) -> String? {
    var request = query(account: account)
    request[kSecReturnData as String] = true
    request[kSecMatchLimit as String] = kSecMatchLimitOne
    var item: CFTypeRef?
    guard SecItemCopyMatching(request as CFDictionary, &item) == errSecSuccess,
          let data = item as? Data else { return nil }
    return String(data: data, encoding: .utf8)
  }

  private static func writePassword(_ password: String) -> Bool {
    writeSecret(password, account: keychainAccount)
  }

  private static func writeSecret(_ value: String, account: String) -> Bool {
    SecItemDelete(query(account: account) as CFDictionary)
    var request = query(account: account)
    request[kSecValueData as String] = Data(value.utf8)
    request[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
    return SecItemAdd(request as CFDictionary, nil) == errSecSuccess
  }

  private static func deletePassword() {
    SecItemDelete(query(account: keychainAccount) as CFDictionary)
  }
}
