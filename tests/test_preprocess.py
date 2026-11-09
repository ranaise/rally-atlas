import json
import unittest

from scripts.preprocess import CACHE, OUT, make_calibration, project, rows


class CalibrationTests(unittest.TestCase):
    def test_identity_and_projective_division(self):
        self.assertEqual(project([[1, 0, 0], [0, 1, 0], [0, 0, 1]], 4, 8), (4, 8))
        self.assertEqual(project([[2, 0, 4], [0, 2, 2], [0, 0, 2]], 4, 8), (6, 9))

    def test_clockwise_orientation_and_no_clamping(self):
        calibration = make_calibration({
            "homography_matrix": "[[1,0,0],[0,1,0],[0,0,1]]",
            "upleft_x": "25", "upleft_y": "150", "upright_x": "325", "upright_y": "150",
            "downleft_x": "25", "downleft_y": "810", "downright_x": "325", "downright_y": "810",
        })
        self.assertEqual(calibration(175, 480), (670, 305))
        self.assertEqual(calibration(25, 810), (0, 0))
        self.assertEqual(calibration(325, 150), (1340, 610))
        self.assertLess(calibration(175, 815)[0], 0)

    @unittest.skipUnless((CACHE / "homography.csv").exists(), "Run the data build to download inputs")
    def test_real_calibrations_and_first_serve(self):
        dataset = json.loads((OUT / "shuttleset.json").read_text(encoding="utf-8"))
        lookup = {int(row["id"]): row for row in rows(CACHE / "homography.csv")}
        for match in dataset["matches"]:
            with self.subTest(match=match["id"]):
                raw = lookup[match["id"]]
                calibrate = make_calibration(raw)
                self.assertAlmostEqual(calibrate(float(raw["upright_x"]), float(raw["upright_y"]))[0], 1340, places=2)
        match = next(match for match in dataset["matches"] if match["id"] == 15)
        first = match["sets"][0]["rallies"][0]["s"][0]
        self.assertEqual(dataset["types"][first[1]], "Short service")
        self.assertEqual(first[2], [round(v, 1) for v in make_calibration(lookup[15])(555, 360)])


if __name__ == "__main__":
    unittest.main()
