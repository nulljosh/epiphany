"""Quality sleeve checks (buy QUAL once). Fake prices, no network, no IB Gateway.

    uv run --with ib_async python3 -m unittest discover -s tests/py
"""
import contextlib, importlib.util, io, json, os, sys, tempfile, unittest
from types import SimpleNamespace as NS
from unittest import mock

HERE = os.path.dirname(__file__)
SCRIPT = os.path.join(HERE, "..", "..", "scripts", "ibkr-quality.py")


def read(path):
    with open(path) as f:
        return f.read()

spec = importlib.util.spec_from_file_location("quality", SCRIPT)
q = importlib.util.module_from_spec(spec)
spec.loader.exec_module(q)


class Plan(unittest.TestCase):
    def test_no_state_buys_whole_shares(self):
        self.assertEqual(q.plan_orders({}, 190.0, 50000), [("buy", "QUAL", 263, 190.0)])

    def test_default_sleeve_is_fifty_thousand(self):
        import inspect
        self.assertIn("default=50000", inspect.getsource(q.main))

    def test_state_with_start_does_nothing(self):
        st = {"start": {"date": "2026-10-01", "sleeve": 50000, "spy": 600.0}, "holdings": {"QUAL": 263}}
        self.assertEqual(q.plan_orders(st, 190.0, 50000), [])

    def test_a_buy_that_has_not_filled_yet_still_does_nothing(self):
        # The start is written before the order goes out, so a run that died mid-fill never buys twice.
        self.assertEqual(q.plan_orders({"start": {"date": "2026-10-01"}, "holdings": {}}, 190.0, 50000), [])

    def test_no_price_no_buy(self):
        self.assertEqual(q.plan_orders({}, 0.0, 50000), [])
        self.assertEqual(q.plan_orders({}, None, 50000), [])

    def test_budget_below_one_share_buys_nothing(self):
        self.assertEqual(q.plan_orders({}, 190.0, 100), [])

    def test_never_sells(self):
        for st in ({}, {"start": {"date": "x"}, "holdings": {"QUAL": 5}}, {"holdings": {"QUAL": 5, "SPY": 9}}):
            for price in (1.0, 190.0, 1e6):
                for order in q.plan_orders(st, price, 50000):
                    self.assertEqual((order[0], order[1]), ("buy", "QUAL"))


class State(unittest.TestCase):
    def test_fill_updates_state(self):
        st = {"holdings": {}, "cash": 50000.0}
        q.apply_fill(st, "buy", "QUAL", 263, 190.0)
        self.assertEqual(st["holdings"], {"QUAL": 263})
        self.assertAlmostEqual(st["cash"], 50000 - 263 * 190.0)
        self.assertEqual(st["last"], {"QUAL": 190.0})

    def test_reconcile_books_a_late_fill_up_to_the_order(self):
        st = {"start": {"date": "x"}, "holdings": {}, "cash": 50000.0, "ordered": 263}
        self.assertTrue(q.reconcile(st, 263, 190.0))
        self.assertEqual(st["holdings"], {"QUAL": 263})
        self.assertFalse(q.reconcile(st, 263, 190.0))  # second look changes nothing

    def test_reconcile_never_books_more_than_ordered(self):
        st = {"start": {"date": "x"}, "holdings": {}, "cash": 50000.0, "ordered": 100}
        q.reconcile(st, 500, 190.0)  # the account holds QUAL from elsewhere too
        self.assertEqual(st["holdings"], {"QUAL": 100})

    def test_reconcile_with_nothing_ordered_is_a_no_op(self):
        st = {"holdings": {}, "cash": 0.0}
        self.assertFalse(q.reconcile(st, 40, 190.0))
        self.assertEqual(st["holdings"], {})


class FakeIB:
    """Just enough of ib_async for main(): one account, no positions, orders that fill at once. Placed orders land in `sent`."""
    sent = []
    account = "DU1234567"

    def connect(self, *a, **k): pass
    def disconnect(self): pass
    def managedAccounts(self): return [self.account]
    def positions(self): return []
    def qualifyContracts(self, c): pass
    def sleep(self, n): pass

    def placeOrder(self, c, o):
        FakeIB.sent.append((o.action, o.totalQuantity, c.symbol, o.tif))
        return NS(orderStatus=NS(status="Filled", filled=o.totalQuantity, avgFillPrice=190.5))


def fake_ib_async():
    mod = NS(IB=FakeIB, Stock=lambda s, *a: NS(symbol=s),
             MarketOrder=lambda side, qty: NS(action=side, totalQuantity=qty, tif=""))
    return mock.patch.dict(sys.modules, {"ib_async": mod})


class Run(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)
        FakeIB.sent, FakeIB.account = [], "DU1234567"
        for p in (mock.patch.object(q, "STATE", os.path.join(self.dir.name, "ibkr-quality.json")),
                  mock.patch.object(q, "closes", lambda sym, now=None: [190.0] if sym == "QUAL" else [600.0]),
                  fake_ib_async()):
            p.start()
            self.addCleanup(p.stop)

    def run_main(self, *args):
        out = io.StringIO()
        with mock.patch.object(sys, "argv", ["ibkr-quality.py", *args]), contextlib.redirect_stdout(out):
            q.main()
        return out.getvalue()

    def test_dry_run_prints_the_plan_and_writes_nothing(self):
        out = self.run_main()
        self.assertIn("buy 263 QUAL", out)
        self.assertEqual(FakeIB.sent, [])
        self.assertFalse(os.path.exists(q.STATE))

    def test_go_buys_once_then_never_again(self):
        self.run_main("--go")
        self.assertEqual(FakeIB.sent, [("BUY", 263, "QUAL", "DAY")])
        st = json.loads(read(q.STATE))
        self.assertEqual(st["holdings"], {"QUAL": 263})
        self.assertEqual((st["start"]["sleeve"], st["start"]["spy"]), (50000, 600.0))
        self.assertEqual(len(st["orders"]), 1)
        out = self.run_main("--go")
        self.assertEqual(len(FakeIB.sent), 1)
        self.assertIn("nothing to do", out)
        self.assertEqual(json.loads(read(q.STATE)), st)

    def test_real_account_is_refused_without_live(self):
        FakeIB.account = "U7654321"
        with self.assertRaises(SystemExit):
            self.run_main("--go")
        self.assertEqual(FakeIB.sent, [])
        self.assertFalse(os.path.exists(q.STATE))


class Source(unittest.TestCase):
    def test_own_client_id_and_state_file(self):
        src = read(SCRIPT)
        self.assertIn("clientId=26", src)
        self.assertTrue(q.STATE.endswith(os.path.join("tradingview", "ibkr-quality.json")))

    def test_refuses_non_demo_accounts_without_live(self):
        src = read(SCRIPT)
        self.assertIn('startswith("D") and not a.live', src)


if __name__ == "__main__":
    unittest.main()
