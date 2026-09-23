import unittest

from app.secure_sql import QueryRejected, validate_read_only_sql


class SecureSqlTests(unittest.TestCase):
    def test_allows_single_select(self):
        self.assertEqual(validate_read_only_sql("SELECT category FROM analytics.category_spending;"), "SELECT category FROM analytics.category_spending")

    def test_rejects_writes_and_multiple_statements(self):
        for statement in ("DELETE FROM analytics.user_transactions", "SELECT 1; SELECT 2", "WITH x AS (DELETE FROM accounts RETURNING id) SELECT * FROM x"):
            with self.subTest(statement=statement):
                with self.assertRaises(QueryRejected):
                    validate_read_only_sql(statement)

    def test_rejects_comments(self):
        with self.assertRaises(QueryRejected):
            validate_read_only_sql("SELECT 1 -- hide a predicate")


if __name__ == "__main__":
    unittest.main()
