import StoreKit

/// StoreKit 2 wrapper for the one non-consumable ("Premium"). A verified transaction is
/// handed to the server, which re-checks it with Apple and flips the account tier, so the
/// app never trusts its own receipt for gating.
/// ponytail: single product, no subscriptions. Add renewal handling if a sub ever ships.
@MainActor
@Observable
final class Store {
    static let premiumID = "com.heyitsmejosh.epiphany.premium"

    var product: Product?
    var isBusy = false
    var error: String?
    private var updates: Task<Void, Never>?

    init() {
        updates = Task { [weak self] in
            for await result in StoreKit.Transaction.updates {
                await self?.handle(result)
            }
        }
    }

    func load() async {
        product = try? await Product.products(for: [Self.premiumID]).first
    }

    func purchase() async {
        guard let product else { return }
        isBusy = true; defer { isBusy = false }
        do {
            switch try await product.purchase() {
            case .success(let result): await handle(result)
            case .userCancelled, .pending: break
            @unknown default: break
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func restore() async {
        isBusy = true; defer { isBusy = false }
        try? await AppStore.sync()
        for await result in StoreKit.Transaction.currentEntitlements { await handle(result) }
    }

    private func handle(_ result: VerificationResult<StoreKit.Transaction>) async {
        guard case .verified(let tx) = result, tx.productID == Self.premiumID else { return }
        do {
            try await EpiphanyAPI.shared.claimPurchase(transactionId: String(tx.id))
            await tx.finish()
            error = nil
        } catch {
            self.error = "Purchase made, but the account was not upgraded. Tap Restore to retry."
        }
    }
}
