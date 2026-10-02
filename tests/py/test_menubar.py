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


def pos(sym, pnl, cost=100.0, qty=1):
    return NS(contract=NS(symbol=sym), unrealizedPNL=pnl, averageCost=cost, position=qty)


class Base(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        d = self.dir.name
        patches = [mock.patch.object(mb, k, os.path.join(d, f)) for k, f in
                   (("TREND", "trend.json"), ("STATE", "state.json"), ("PAUSED", "paused"), ("LOG", "log.txt"))]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        self.addCleanup(self.dir.cleanup)

    def write(self, path, text):
        with open(path, "w") as f:
            f.write(text)


class Json(Base):
    def test_missing_corrupt_and_wrong_type_read_as_default(self):
        self.assertEqual(mb.read_json(mb.STATE, {}), {})
        self.write(mb.STATE, '{"high": 1')
        self.assertEqual(mb.read_json(mb.STATE, {}), {})
        self.write(mb.STATE, "[1, 2]")
        self.assertEqual(mb.read_json(mb.STATE, {}), {})

    def test_write_is_atomic_and_round_trips(self):
        mb.write_json(mb.STATE, {"high": 2})
        self.assertEqual(mb.read_json(mb.STATE, {}), {"high": 2})
        self.assertFalse(os.path.exists(mb.STATE + ".tmp"))

    def test_num(self):
        for bad in (None, "x", math.nan, math.inf):
            self.assertEqual(mb.num(bad), 0.0)
        self.assertEqual(mb.num("1.5"), 1.5)


ST = {"start": {"date": "2026-10-01"}}


class Summarize(Base):
    def run_with_spy(self, port, spy, mst=None):
        with mock.patch.object(mb, "sp500", return_value=spy):
            return mb.summarize(port, ST, mst or {})

    def test_verdict_text_per_band(self):
        port = [pos("XLE", 0.61, cost=100), pos("DIA", -0.40, cost=100)]  # holdings +0.105%
        for spy, text, v, bar in ((0.0, "Matching the market", "even", "Even +0.10%"), (-0.01, "Beating the market", "up", "Beating 1.10%"), (0.02, "Trailing the market", "down", "Trailing 1.90%")):
            title, rows, got = self.run_with_spy(port, spy)
            self.assertEqual((rows[0][0], got, title), (text, v, bar))

    def test_why_rows_beating_and_trailing(self):
        port = [pos("XLE", 0.61, cost=100), pos("DIA", -0.40, cost=100), pos("SPY", 0.12, cost=100)]
        _, rows, _ = self.run_with_spy(port, -0.0002)
        self.assertEqual(rows[1][0], "Holdings +0.11% vs S&P 500 \u22120.02% since Oct 1")
        self.assertEqual(rows[2][0], "XLE leads, up 0.61%")
        _, rows, v = self.run_with_spy(port, 0.02)
        self.assertEqual(v, "down")
        self.assertEqual(rows[2][0], "DIA drags, down 0.40%")

    def test_trend_sleeve_stays_out_of_the_scoreboard(self):
        # $100k of SSO bought minutes ago must not drown the day old Double 7s buys: the score ignores it.
        port = [pos("XLE", 0.61, cost=100), pos("SSO", 0.0, cost=100000), pos("BIL", 0.0, cost=100000)]
        title, rows, v = self.run_with_spy(port, 0.0)
        self.assertEqual((title, v), ("Beating 0.61%", "up"))

    def test_sold_positions_stay_in_the_score(self):
        st = {**ST, "orders": [
            {"symbol": "XLE", "side": "buy", "qty": 10, "status": "Filled", "fill": 50.0},
            {"symbol": "XLE", "side": "sell", "qty": 10, "status": "Filled", "fill": 60.0},  # +100 on 500
            {"symbol": "X", "side": "buy", "qty": 1, "status": "Filled", "fill": 100.0},  # still held, live numbers win
            {"symbol": "SSO", "side": "buy", "qty": 5, "status": "Filled", "fill": 70.0},
            {"symbol": "SSO", "side": "sell", "qty": 5, "status": "Filled", "fill": 99.0},  # Trend sleeve stays out
            {"symbol": "Q", "side": "sell", "qty": 1, "status": "PreSubmitted", "fill": 0.0}]}
        with mock.patch.object(mb, "sp500", return_value=0.0):
            _, rows, _ = mb.summarize([pos("X", 0.0, cost=100.0)], st, {})
        self.assertIn("Holdings +16.67%", rows[1][0])  # (0 + 100) / (100 + 500)
        self.assertEqual(mb.closed("garbage", set()), (0, 0))

    def test_no_holdings(self):
        title, rows, v = self.run_with_spy([], 0.05)
        self.assertEqual((title, v, rows[0][0]), ("+0.00%", None, "No trades yet"))
        self.assertTrue(all(not t for t, _ in rows[1:3]))

    def test_yahoo_failure_hides_comparison(self):
        with mock.patch.object(mb, "yahoo", side_effect=OSError):
            title, rows, v = mb.summarize([pos("X", 1)], ST, {})
        self.assertIsNone(v)
        self.assertEqual(rows[0][0], "Market data unavailable")
        self.assertTrue(all(not t for t, _ in rows[1:3]))

    def test_garbage_never_raises(self):
        # NaN P&L before market data, zero cost basis, broken state, junk dates.
        for st in ({}, {"start": "oops"}, {"start": {"date": "nope"}}):
            title, rows, _ = mb.summarize([pos("X", math.nan, cost=0)], st, {})
            self.assertEqual(title, "+0.00%")
            self.assertEqual(len(rows), 4)

    def test_sp500_parses_spark(self):
        day = lambda d: datetime(2026, 9, d, 13, 30, tzinfo=timezone.utc).timestamp()
        bars = lambda a, b: {"timestamp": [day(1), day(2)], "close": [a, b]}
        with mock.patch.object(mb, "yahoo", return_value={"SPY": bars(100, 110)}):
            self.assertAlmostEqual(mb.sp500(datetime(2026, 9, 2, 10, 0)), 0.10)
        # Today's bar blanked after the close: the live price wins, not yesterday's close (read +0.00%).
        with mock.patch.object(mb, "yahoo", return_value={"SPY": bars(100, None) | {"fulldayPrice": 105}}):
            self.assertAlmostEqual(mb.sp500(datetime(2026, 9, 2, 10, 0)), 0.05)
        # Measured from our own fill, not the night before: 105 now against a 102.5 entry is +2.44%, not +5%.
        with mock.patch.object(mb, "yahoo", return_value={"SPY": bars(100, None) | {"fulldayPrice": 105}}):
            self.assertAlmostEqual(mb.sp500(datetime(2026, 9, 2, 10, 0), 102.5), 105 / 102.5 - 1)

    def test_verdict_bands(self):
        self.assertEqual(mb.verdict(0.012, 0.005), "up")
        self.assertEqual(mb.verdict(0.0017, 0.0020), "even")  # trailing by a hair is a tie
        self.assertEqual(mb.verdict(0.0060, 0.0050), "even")  # ahead by a hair too
        self.assertEqual(mb.verdict(-0.01, 0.002), "down")

    def test_trend_row_with_and_without_state(self):
        self.assertEqual(self.run_with_spy([pos("X", 1)], 0.0)[1][3][0], "")
        self.assertEqual(self.run_with_spy([pos("X", 1)], 0.0, {"holdings": {"SSO": 10}})[1][3][0], "Trend 2x: holding 2x S&P")
        self.assertEqual(self.run_with_spy([pos("X", 1)], 0.0, {"holdings": {"BIL": 10}})[1][3][0], "Trend 2x: in T-bills, S&P below its 200-day")
        # No holdings in the main account still shows what Trend 2x holds.
        self.assertEqual(self.run_with_spy([], 0.0, {"holdings": {"SSO": 1}})[1][3][0], "Trend 2x: holding 2x S&P")

    def test_trend_state_garbage_never_raises(self):
        for bad in ({"start": "x"}, {"holdings": 3}, {"holdings": {}}, {}):
            self.assertIsNone(mb.trend_row(bad))

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


if __name__ == "__main__":
    unittest.main()


class Names(unittest.TestCase):
    def test_every_name_the_app_calls_exists(self):
        # refresh() only runs inside AppKit, so the unit tests never execute it; a deleted helper crashed the live app.
        import ast, builtins
        tree = ast.parse(open(spec.origin).read())
        defined = {n.name for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.ClassDef))} | set(dir(builtins)) | set(vars(mb)) | {a.asname or a.name for n in ast.walk(tree) if isinstance(n, (ast.Import, ast.ImportFrom)) for a in n.names}
        called = {n.func.id for n in ast.walk(tree) if isinstance(n, ast.Call) and isinstance(n.func, ast.Name)}
        self.assertEqual(called - defined, set())
