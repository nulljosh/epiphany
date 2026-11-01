"""WHITEPAPER benchmark tables must match tradingview/results.json. No network.

Fix a failure with `python3 tradingview/backtest.py whitepaper`.
"""
import json, os, sys, unittest

HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, "..", "..", "tradingview"))
import backtest as bt  # noqa: E402


class Drift(unittest.TestCase):
    def test_every_generated_block_matches_results(self):
        data = json.load(open(bt.RESULTS))
        found = bt.blocks(open(bt.WHITEPAPER).read())
        self.assertTrue(found, "WHITEPAPER has no <!-- results:key --> blocks")
        for key, body in found.items():
            self.assertEqual(body, bt.render(key, data[key]), f"{key} drifted from results.json")

    def test_render_reads_the_numbers(self):
        row = {"X": {"Hold": {"cagr": 0.42, "mdd": 0.77, "trades": 1}, "Double 7s": {"cagr": 0.17, "mdd": 0.35, "trades": 53}}}
        self.assertIn("| X | 42% | 77% | 17% | 35% | 53 |", bt.render("assets", row))


class WalkForward(unittest.TestCase):
    def test_hold_on_a_steady_climb_chains_to_the_climb(self):
        # 0.05% a day for 8 years: Hold re-buys each Jan 1, so the chain is the climb less two fees a year.
        day = 86400
        start = 1262304000  # 2010-01-01
        bars = [[start + i * day, 100 * 1.0005 ** i, 100 * 1.0005 ** i * 1.001, 100 * 1.0005 ** i * 0.999, 100 * 1.0005 ** i] for i in range(8 * 365)]
        r = bt.walk_years(bars, modes=["Hold"])["Hold"]
        self.assertAlmostEqual(r["cagr"], 1.0005 ** 365.25 - 1, delta=0.01)
        self.assertLess(r["worst"], 0.01)
        self.assertEqual(r["from"], 2013)


if __name__ == "__main__":
    unittest.main()
