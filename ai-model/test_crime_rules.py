import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from crime_rules import find_explicit_crime_event


class CrimeRuleTests(unittest.TestCase):
    def test_clear_crime_events(self):
        cases = {
            "Qarax ayaa ka dhacay suuqa, dad badan ayaa ku dhaawacmay.": "qarax",
            "Koox hubeysan ayaa weerartay guri, laba qofna way dhaawacmeen.": "weerar",
            "Gabadh ayaa la afduubay iyadoo iskuulka kasoo baxday.": "afduub",
            "Tuug ayaa xalay dukaan ka xaday lacag.": "xatooyo",
            "Nin ayaa lagu dilay degmada Hodan.": "dil",
        }
        for text, expected in cases.items():
            with self.subTest(text=text):
                self.assertEqual(find_explicit_crime_event(text), expected)

    def test_context_is_not_treated_as_an_event(self):
        cases = [
            "Filimka cusub wuxuu ka hadlayaa qarax iyo dagaal.",
            "Waxaan akhriyey taariikhda weerarkii hore.",
            "Booliska ayaa sheegay in qaraxu ahaa war been abuur ah.",
            "Ciyaaryahan ayaa dhaawac ku gaaray garoonka kubadda cagta.",
        ]
        for text in cases:
            with self.subTest(text=text):
                self.assertIsNone(find_explicit_crime_event(text))


if __name__ == "__main__":
    unittest.main()
