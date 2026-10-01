"""Menu bar app checks. No IB Gateway, no network, no AppKit.

    uv run --with ib_async python3 -m unittest discover -s tests/py
"""
import importlib.util, json, math, os, tempfile, unittest
from datetime import datetime, timezone
from types import SimpleNamespace as NS
from unittest import mock

spec = importlib.util.spec_from_file_location("menubar", os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "menubar.py"))
mb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mb)
REAL_BENCHMARKS = mb.benchmarks  # Base patches it out; the parser test needs the real one


def pos(sym, pnl, cost=100.0, qty=1):
    return NS(contract=NS(symbol=sym), unrealizedPNL=pnl, averageCost=cost, position=qty)


class Base(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        d = self.dir.name
        patches = [mock.patch.object(mb, k, os.path.join(d, f)) for k, f in
                   (("BEST", "best.json"), ("MOM", "mom.json"), ("STATE", "state.json"), ("PAUSED", "paused"), ("LOG", "log.txt"))]
        patches.append(mock.patch.object(mb, "benchmarks", return_value={"S&P 500": 0.10, "Gold": -0.01}))
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        self.addCleanup(self.dir.cleanup)

    def write(self, path, text):
        with open(path, "w") as f:
            f.write(text)


class Json(Base):
    def test_missing_corrupt_and_wrong_type_read_as_default(self):
        self.assertEqual(mb.read_json(mb.BEST, {}), {})
        self.write(mb.BEST, '{"high": 1')
        self.assertEqual(mb.read_json(mb.BEST, {}), {})
        self.write(mb.BEST, "[1, 2]")
        self.assertEqual(mb.read_json(mb.BEST, {}), {})

    def test_write_is_atomic_and_round_trips(self):
        mb.write_json(mb.BEST, {"high": 2})
        self.assertEqual(mb.read_json(mb.BEST, {}), {"high": 2})
        self.assertFalse(os.path.exists(mb.BEST + ".tmp"))

    def test_num(self):
        for bad in (None, "x", math.nan, math.inf):
            self.assertEqual(mb.num(bad), 0.0)
        self.assertEqual(mb.num("1.5"), 1.5)


class Summarize(Base):
    def test_normal_account(self):
        self.write(mb.STATE, json.dumps({"start": {"netLiquidation": 1000, "spy": 500, "date": "2026-09-01"}}))
        title, since, rows, _ = mb.summarize([pos("AAPL", 10), pos("TSLA", -5)], 1020.0, mb.read_json(mb.STATE, {}))
        self.assertEqual(title, "+2.50%")
        self.assertEqual(since, "Since Sep 1")
        r = dict((l, v) for l, v, _ in rows)
        self.assertEqual(r["S&P 500  +10.00%"], "behind 7.50%")
        self.assertEqual(r["Gold  \u22121.00%"], "ahead 3.50%")
        self.assertIn("Best · AAPL", r)
        self.assertIn("Worst · TSLA", r)
        self.assertEqual(mb.read_json(mb.BEST, {}), {"high": 20.0, "low": 20.0})

    def test_garbage_never_raises(self):
        # NaN P&L before market data, zero cost basis, broken state, corrupt record file, no net liquidation.
        self.write(mb.BEST, "not json")
        for st in ({}, {"start": "oops"}, {"start": {"netLiquidation": "x", "spy": 0, "date": "nope"}}):
            title, since, rows, _ = mb.summarize([pos("X", math.nan, cost=0)], None, st)
            self.assertEqual((title, since), ("+0.00%", "Since start"))
            self.assertTrue(all(isinstance(v, str) and "nan" not in v for _, v, _ in rows))

    def test_benchmark_failure_hides_rows(self):
        with mock.patch.object(mb, "benchmarks", side_effect=OSError):
            rows = mb.summarize([pos("X", 1)], 1.0, {"start": {"date": "2026-09-01"}})[2]
        self.assertEqual(len(rows), 2 + len(mb.BENCH) + 6)
        self.assertFalse(any("S&P" in l for l, _, _ in rows))

    def test_benchmarks_parse_spark(self):
        day = lambda d: datetime(2026, 9, d, 13, 30, tzinfo=timezone.utc).timestamp()
        bars = lambda a, b: {"timestamp": [day(1), day(2)], "close": [a, b]}
        fake = {s: bars(100, 110) for s in mb.ETFS} | {"GLD": bars(50, None), "BTC-USD": {"close": None}}
        with mock.patch.object(mb, "yahoo", return_value=fake):
            b = REAL_BENCHMARKS(datetime(2026, 9, 2, 10, 0))
        self.assertAlmostEqual(b["S&P 500"], 0.10)
        self.assertAlmostEqual(b["All 16 funds"], 0.10)
        self.assertEqual(b["Gold"], 0.0)  # today's bar not in yet: last real close
        self.assertNotIn("Bitcoin", b)
        self.assertEqual(list(b)[:2], ["S&P 500", "All 16 funds"])

    def test_record_keeps_extremes(self):
        mb.write_json(mb.BEST, {"high": 50, "low": -30})
        mb.summarize([], 1010.0, {"start": {"netLiquidation": 1000}})
        self.assertEqual(mb.read_json(mb.BEST, {}), {"high": 50, "low": -30})

    def test_chart_symbols_dedupe_and_label(self):
        rows = [("Best \u00b7 IWM", "", 1), ("Worst \u00b7 SPY", "", -1)]
        with mock.patch.object(mb, "top_gainer", return_value="XYZ"):
            self.assertEqual(mb.chart_symbols(rows), [("SPY", "SPY"), ("XYZ", "XYZ \u00b7 Top gainer"), ("IWM", "IWM")])
        with mock.patch.object(mb, "top_gainer", return_value=None):
            self.assertEqual(mb.chart_symbols([]), [("SPY", "SPY")])

    def test_verdict_bands(self):
        self.assertEqual(mb.verdict(0.012, 0.005), "up")
        self.assertEqual(mb.verdict(0.0017, 0.0020), "even")  # trailing by a hair is a tie
        self.assertEqual(mb.verdict(0.0060, 0.0050), "even")  # ahead by a hair too
        self.assertEqual(mb.verdict(-0.01, 0.002), "down")

    def test_momentum_rows_hidden_without_state(self):
        rows = mb.summarize([pos("X", 1)], 1.0, {})[2]
        self.assertEqual(rows[-4:-2], [("", "", None)] * 2)
        self.assertEqual(len(rows), sum(n for _, n in mb.GROUPS))

    def test_momentum_rows_with_state(self):
        mom = {"start": {"date": "2026-09-01", "sleeve": 1000, "spy": 500}, "cash": 100.0, "holdings": {"AAA": 10}, "last": {"AAA": 90.0},
               "lastRebalance": "2026-09"}
        self.write(mb.MOM, json.dumps(mom))
        rows = mb.summarize([pos("AAA", 1)], 1.0, {})[2]
        r = dict((l, v) for l, v, _ in rows)
        # cash 100 + 10 shares at the held price (marketPrice missing on the fake, so the last fill 90) = 1000 -> flat, S&P +10%
        self.assertEqual(r["Momentum  +0.00%"], "behind 10.00%")
        self.assertIn("Next rebalance", r)
        self.assertEqual(len(rows), sum(n for _, n in mb.GROUPS))

    def test_momentum_state_garbage_never_raises(self):
        for bad in ('{"start": "x"}', '{"start": {"sleeve": 0}}', "[1]", '{"start": {"sleeve": 5, "date": "bad"}, "holdings": 3}'):
            self.write(mb.MOM, bad)
            self.assertEqual(len(mb.summarize([], None, {})[2]), sum(n for _, n in mb.GROUPS))

    def test_next_rebalance(self):
        ny = lambda *a: datetime(*a, tzinfo=mb.ZoneInfo("America/New_York"))
        self.assertEqual(mb.next_rebalance({}, ny(2026, 10, 1, 16, 0)), "Now")
        self.assertIn(mb.next_rebalance({"lastRebalance": "2026-10"}, ny(2026, 10, 1, 16, 0)), ("Nov 2", "Nov 1"))
        self.assertTrue(mb.next_rebalance({"lastRebalance": "2026-10"}, ny(2026, 10, 1, 16, 0)).endswith("Nov 2"))

    def test_paused(self):
        self.write(mb.PAUSED, "")
        self.assertEqual(mb.summarize([], None, {})[2][-1][1], "Paused")

    def test_gateway_down(self):
        with mock.patch.object(mb, "IB") as ib:
            ib.return_value.connect.side_effect = ConnectionRefusedError
            ib.return_value.isConnected.return_value = False
            self.assertEqual(mb.snapshot()[0], "!")


class SingleInstance(Base):
    def test_second_copy_exits_before_touching_the_ui(self):
        import fcntl, sys
        os.makedirs(os.path.join(self.dir.name, "tradingview"))
        with mock.patch.object(mb, "ROOT", self.dir.name), mock.patch.object(sys, "argv", ["menubar.py"]):
            held = open(os.path.join(self.dir.name, "tradingview", "menubar.lock"), "w")
            fcntl.flock(held, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.assertIsNone(mb.main())  # would raise ImportError on rumps if it got past the lock
            held.close()

    def test_hide_gateway_without_gateway_is_a_no_op(self):
        with mock.patch.object(mb.subprocess, "run", return_value=NS(stdout="")):
            self.assertIsNone(mb.hide_gateway())


class NextTrade(unittest.TestCase):
    def test_always_a_weekday_label(self):
        for st in ({}, {"lastGo": "1999-01-01"}):
            out = mb.next_trade(st)
            self.assertTrue(out == "Now" or out.split()[0] in ("Today", "Mon", "Tue", "Wed", "Thu", "Fri"), out)


if __name__ == "__main__":
    unittest.main()


class Watchlist(unittest.TestCase):
    def test_line_formats_and_tolerates_missing(self):
        self.assertEqual(mb.watch_line("PLTR", (190.04, 0.016)), "PLTR  190.04  +1.60%")
        self.assertEqual(mb.watch_line("DIS", (101.36, -0.0337)), "DIS  101.36  −3.37%")
        self.assertEqual(mb.watch_line("CADUSD=X", (0.7031, 0.0003)), "CADUSD=X  0.7031  +0.03%")
        self.assertEqual(mb.watch_line("SPCX", None), "SPCX  —")

    def test_quotes_batches_and_skips_empty(self):
        calls = []
        def fake(path):
            calls.append(path)
            return {"PLTR": {"fulldayPrice": 190.04, "fulldayChangePercent": 1.6}, "BAD": {"fulldayPrice": None}}
        with mock.patch.object(mb, "yahoo", fake):
            q = mb.watch_quotes(mb.WATCH)
        self.assertEqual(len(calls), 2)  # 36 symbols, 20 per call
        self.assertAlmostEqual(q["PLTR"][1], 0.016)
        self.assertNotIn("BAD", q)
