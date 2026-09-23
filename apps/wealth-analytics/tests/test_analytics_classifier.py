import unittest

from app.analytics import classify


class AnalyticsClassifierTests(unittest.TestCase):
    def test_comparison_follow_up_is_comparison(self):
        self.assertEqual(classify("Compare this with last month"), "comparison")
        self.assertEqual(classify("Show my biggest expenses"), "merchant_analysis")

    def test_goal_and_scenario_queries_have_specific_intents(self):
        self.assertEqual(classify("How am I progressing toward my emergency fund goal?"), "goal_analysis")
        self.assertEqual(classify("What if I save another 2000 each month?"), "scenario_analysis")


if __name__ == "__main__":
    unittest.main()
