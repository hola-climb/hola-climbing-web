// swift-tools-version: 5.9
import PackageDescription

// npm 패키지명 "capacitor-hola-sse" → Capacitor CLI 의 fixName 규칙으로
// SPM 패키지/프로덕트명이 "CapacitorHolaSse" 로 생성되므로 동일하게 맞춘다.
let package = Package(
    name: "CapacitorHolaSse",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapacitorHolaSse",
            targets: ["HolaSsePlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "HolaSsePlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/HolaSsePlugin")
    ]
)
