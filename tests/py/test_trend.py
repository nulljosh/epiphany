"""Trend 2x sleeve checks. Fake prices, no network, no IB Gateway.

    uv run --with ib_async python3 -m unittest discover -s tests/py
"""
import importlib.util, os, unittest

HERE = os.path.dirname(__file__)
spec = importlib.util.spec_from_file_location("trend", os.path.join(HERE, "..", "..", "scripts", "ibkr-trend.py"))
tr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tr)

P = {"SSO": 90.0, "BIL": 91.0}


class Target(unittest.TestCase):
    def test_above_average_is_sso(self):
        self.assertEqual(tr.target([100 + i for i in range(250)]), "SSO")

    def test_below_average_is_bil(self):
        self.assertEqual(tr.target([400 - i for i in range(250)]), "BIL")

    def test_needs_200_closes(self):
        self.assertIsNone(tr.target([100.0] * 199))


class Plan(unittest.TestCase):
    def test_fresh_sleeve_buys_whole_shares_of_target(self):
        self.assertEqual(tr.plan_orders("SSO", P, {}, 100000), [("buy", "SSO", 1111, 90.0)])

    def test_same_side_does_nothing(self):
        self.assertEqual(tr.plan_orders("SSO", P, {"SSO": 1111}, 100000), [])

    def test_switch_sells_old_side_then_buys_new(self):
        p = tr.plan_orders("BIL", P, {"SSO": 1111}, 100000)
        self.assertEqual(p, [("sell", "SSO", 1111, 90.0), ("buy", "BIL", 1098, 91.0)])

    def test_never_sells_unowned(self):
        self.assertEqual([x for x in tr.plan_orders("BIL", P, {}, 5000) if x[0] == "sell"], [])
        self.assertEqual([x for x in tr.plan_orders("SSO", P, {"SSO": 3}, 5000) if x[0] == "sell"], [])

    def test_sells_only_the_owned_count(self):
        p = tr.plan_orders("SSO", P, {"BIL": 7}, 1000)
        self.assertEqual(p[0], ("sell", "BIL", 7, 91.0))

    def test_never_touches_other_symbols(self):
        for x in tr.plan_orders("BIL", P, {"SSO": 5, "SPY": 9, "QQQ": 4}, 10000):
            self.assertIn(x[1], ("SSO", "BIL"))

    def test_no_price_no_buy(self):
        self.assertEqual(tr.plan_orders("SSO", {}, {}, 1000), [])

    def test_fills_update_state(self):
        st = {"holdings": {}, "cash": 1000.0}
        tr.apply_fill(st, "buy", "SSO", 5, 100.0)
        self.assertEqual((st["holdings"], st["cash"]), ({"SSO": 5}, 500.0))
        tr.apply_fill(st, "sell", "SSO", 5, 110.0)
        self.assertEqual((st["holdings"], st["cash"]), ({}, 1050.0))


if __name__ == "__main__":
    unittest.main()
