"""Momentum sleeve checks. Fake prices, no network, no IB Gateway.

    uv run --with ib_async python3 -m unittest discover -s tests/py
"""
import importlib.util, os, unittest

HERE = os.path.dirname(__file__)
spec = importlib.util.spec_from_file_location("mom", os.path.join(HERE, "..", "..", "scripts", "ibkr-momentum.py"))
mom = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mom)


def panel(trend, n=420, syms=30):
    """Fake bars: symbol k grows k basis points a day, times `trend` (1 up, -1 down for the whole basket)."""
    names = [f"S{k}" for k in range(syms)]
    days = list(range(n))
    C = {s: [100 * (1 + trend * (k + 1) * 0.0004) ** i for i in range(n)] for k, s in enumerate(names)}
    return days, names, C, C, C, C


class Choose(unittest.TestCase):
    def test_uptrend_picks_the_strongest_twenty(self):
        picks = mom.choose(*panel(1))
        self.assertEqual(len(picks), 20)
        self.assertEqual(set(picks), {f"S{k}" for k in range(10, 30)})

    def test_trend_off_is_cash(self):
        self.assertEqual(mom.choose(*panel(-1)), [])


class Plan(unittest.TestCase):
    prices = {"AAA": 100.0, "BBB": 50.0, "CCC": 10.0}

    def test_fresh_sleeve_buys_equal_whole_shares(self):
        p = mom.plan_orders(["AAA", "BBB"], self.prices, {}, 10000)
        self.assertEqual(p, [("buy", "AAA", 50, 100.0), ("buy", "BBB", 100, 50.0)])

    def test_sells_only_what_the_sleeve_owns(self):
        owned = {"CCC": 7}
        p = mom.plan_orders(["AAA"], self.prices, owned, 1000)
        self.assertIn(("sell", "CCC", 7, 10.0), p)
        self.assertEqual({s for side, s, *_ in p if side == "sell"}, {"CCC"})
        for side, s, q, _ in p:
            if side == "sell":
                self.assertLessEqual(q, owned[s])

    def test_never_touches_double_7s_funds(self):
        for fund in mom.ETFS:
            self.assertNotIn(fund, [x[1] for x in mom.plan_orders(["AAA"], self.prices, {"CCC": 3}, 1000)])

    def test_trend_off_sells_everything_owned(self):
        p = mom.plan_orders([], self.prices, {"AAA": 5, "CCC": 9}, 1000)
        self.assertEqual(p, [("sell", "AAA", 5, 100.0), ("sell", "CCC", 9, 10.0)])

    def test_trims_overweight_and_adds_underweight(self):
        p = mom.plan_orders(["AAA", "BBB"], self.prices, {"AAA": 80, "BBB": 10}, 10000)
        self.assertEqual(p, [("sell", "AAA", 30, 100.0), ("buy", "BBB", 90, 50.0)])

    def test_unpriced_owned_stock_still_sells(self):
        self.assertEqual(mom.plan_orders(["AAA"], {"AAA": 100.0}, {"ZZZ": 4}, 1000)[0], ("sell", "ZZZ", 4, 0.0))

    def test_fills_update_state(self):
        st = {"holdings": {}, "cash": 1000.0}
        mom.apply_fill(st, "buy", "AAA", 5, 100.0)
        self.assertEqual((st["holdings"], st["cash"]), ({"AAA": 5}, 500.0))
        mom.apply_fill(st, "sell", "AAA", 5, 110.0)
        self.assertEqual((st["holdings"], st["cash"]), ({}, 1050.0))


if __name__ == "__main__":
    unittest.main()
