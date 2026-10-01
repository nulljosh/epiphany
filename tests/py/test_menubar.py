"""Menu bar app checks. No IB Gateway, no network, no AppKit.

    uv run --with ib_async python3 -m unittest discover -s tests/py
"""
import importlib.util, json, math, os, tempfile, unittest
from types import SimpleNamespace as NS
from unittest import mock

spec = importlib.util.spec_from_file_location("menubar", os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "menubar.py"))
mb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mb)


def pos(sym, pnl, cost=100.0, qty=1):
    return NS(contract=NS(symbol=sym), unrealizedPNL=pnl, averageCost=cost, position=qty)


class Base(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        d = self.dir.name
        patches = [mock.patch.object(mb, k, os.path.join(d, f)) for k, f in
                   (("BEST", "best.json"), ("STATE", "state.json"), ("PAUSED", "paused"), ("LOG", "log.txt"))]
        patches.append(mock.patch.object(mb, "spy_price", return_value=550.0))
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
        title, since, rows = mb.summarize([pos("AAPL", 10), pos("TSLA", -5)], 1020.0, mb.read_json(mb.STATE, {}))
        self.assertEqual(title, "+20")
        self.assertEqual(since, "Since Sep 1")
        r = dict((l, v) for l, v, _ in rows)
        self.assertEqual(r["SPY"], "+10.00%")
        self.assertIn("Best · AAPL", r)
        self.assertIn("Worst · TSLA", r)
        self.assertEqual(mb.read_json(mb.BEST, {}), {"high": 20.0, "low": 20.0})

    def test_garbage_never_raises(self):
        # NaN P&L before market data, zero cost basis, broken state, corrupt record file, no net liquidation.
        self.write(mb.BEST, "not json")
        for st in ({}, {"start": "oops"}, {"start": {"netLiquidation": "x", "spy": 0, "date": "nope"}}):
            title, since, rows = mb.summarize([pos("X", math.nan, cost=0)], None, st)
            self.assertEqual((title, since), ("+0", "Since start"))
            self.assertTrue(all(isinstance(v, str) and "nan" not in v for _, v, _ in rows))

    def test_spy_failure_reads_zero(self):
        with mock.patch.object(mb, "spy_price", side_effect=OSError):
            rows = mb.summarize([], 1.0, {"start": {"spy": 500}})[2]
        self.assertEqual(dict((l, v) for l, v, _ in rows)["SPY"], "+0.00%")

    def test_record_keeps_extremes(self):
        mb.write_json(mb.BEST, {"high": 50, "low": -30})
        mb.summarize([], 1010.0, {"start": {"netLiquidation": 1000}})
        self.assertEqual(mb.read_json(mb.BEST, {}), {"high": 50, "low": -30})

    def test_paused(self):
        self.write(mb.PAUSED, "")
        self.assertEqual(mb.summarize([], None, {})[2][-1][1], "Paused")

    def test_gateway_down(self):
        with mock.patch.object(mb, "IB") as ib:
            ib.return_value.connect.side_effect = ConnectionRefusedError
            ib.return_value.isConnected.return_value = False
            self.assertEqual(mb.snapshot()[0], "!")


class NextTrade(unittest.TestCase):
    def test_always_a_weekday_label(self):
        for st in ({}, {"lastGo": "1999-01-01"}):
            out = mb.next_trade(st)
            self.assertTrue(out == "Now" or out.split()[0] in ("Today", "Mon", "Tue", "Wed", "Thu", "Fri"), out)


if __name__ == "__main__":
    unittest.main()
