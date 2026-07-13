"""Tests for Strategy Weight Engine."""

from core.decision.weighting import StrategyWeightEngine


class TestStrategyWeightEngine:
    def setup_method(self):
        self.swe = StrategyWeightEngine()

    def test_default_weight(self):
        w = self.swe.get_weight("Unknown")
        assert w == 1.0

    def test_update_won_increases_weight(self):
        self.swe.update("Momentum", won=True)
        w = self.swe.get_weight("Momentum")
        assert w >= 1.0  # win_rate > 0.5 → weight > 1.0

    def test_update_lost_decreases_weight(self):
        self.swe.update("Bad", won=False)
        w = self.swe.get_weight("Bad")
        assert w <= 1.0  # win_rate < 0.5 → weight < 1.0

    def test_multiple_updates(self):
        """3 wins → вес > 1"""
        for _ in range(3):
            self.swe.update("Momentum", won=True)
        w = self.swe.get_weight("Momentum")
        assert w > 1.0

    def test_mixed_results(self):
        """2 wins, 1 loss → вес > 1, но меньше чем 3 wins"""
        self.swe.update("M", won=True)
        self.swe.update("M", won=True)
        self.swe.update("M", won=False)
        w_mixed = self.swe.get_weight("M")

        self.swe.update("N", won=True)
        self.swe.update("N", won=True)
        self.swe.update("N", won=True)
        w_all_wins = self.swe.get_weight("N")

        assert w_mixed < w_all_wins

    def test_get_all_weights(self):
        self.swe.update("Momentum", won=True)
        self.swe.update("ICT", won=False)
        all_w = self.swe.get_all_weights()
        assert "Momentum" in all_w
        assert "ICT" in all_w
        assert all_w["Momentum"] >= 1.0
        assert all_w["ICT"] <= 1.0

    def test_get_weight_objects(self):
        self.swe.update("Momentum", won=True)
        objects = self.swe.get_weight_objects()
        assert "Momentum" in objects
        assert objects["Momentum"].total_signals == 1

    def test_get_or_create(self):
        sw = self.swe.get_or_create("New")
        assert sw.strategy == "New"
        assert sw.weight == 1.0
        # Повторный вызов возвращает тот же объект
        sw2 = self.swe.get_or_create("New")
        assert sw is sw2

    def test_reset(self):
        self.swe.update("Momentum", won=True)
        assert self.swe.get_weight("Momentum") > 1.0
        self.swe.reset("Momentum")
        assert self.swe.get_weight("Momentum") == 1.0

    def test_reset_all(self):
        self.swe.update("Momentum", won=True)
        self.swe.update("ICT", won=False)
        self.swe.reset_all()
        assert len(self.swe.get_all_weights()) == 0

    def test_to_dict(self):
        self.swe.update("Momentum", won=True)
        d = self.swe.to_dict()
        assert "Momentum" in d
        assert "weight" in d["Momentum"]
