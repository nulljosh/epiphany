import StoreKit
import SwiftUI

// TODO: Requires App Store Connect product configuration before this will work
@MainActor
@Observable
final class StoreKitManager {
    static let shared = StoreKitManager()

    private(set) var products: [Product] = []
    private(set) var purchasedProductIDs: Set<String> = []
    private var transactionListener: Task<Void, Never>?

    private let productIDs: Set<String> = [
        "com.heyitsmejosh.opticon.pro",
        "com.heyitsmejosh.opticon.ultra",
    ]

    private init() {
        transactionListener = listenForTransactions()
    }

    func cleanup() {
        transactionListener?.cancel()
    }

    func loadProducts() async {
        do {
            products = try await Product.products(for: productIDs)
                .sorted { $0.price < $1.price }
        } catch {
            print("[StoreKit] Failed to load products: \(error)")
        }
    }

    func purchase(_ product: Product) async throws -> StoreKit.Transaction? {
        let result = try await product.purchase()
        switch result {
        case .success(let verification):
            guard case .verified(let transaction) = verification else { return nil }
            purchasedProductIDs.insert(transaction.productID)
            await transaction.finish()
            return transaction
        case .userCancelled, .pending:
            return nil
        @unknown default:
            return nil
        }
    }

    func restorePurchases() async {
        for await result in StoreKit.Transaction.currentEntitlements {
            if case .verified(let transaction) = result {
                purchasedProductIDs.insert(transaction.productID)
            }
        }
    }

    private func listenForTransactions() -> Task<Void, Never> {
        Task { @MainActor in
            for await result in StoreKit.Transaction.updates {
                if case .verified(let transaction) = result {
                    purchasedProductIDs.insert(transaction.productID)
                    await transaction.finish()
                }
            }
        }
    }
}

enum StoreError: Error {
    case unverified
}
