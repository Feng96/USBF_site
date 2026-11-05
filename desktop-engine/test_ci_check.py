"""CI mount cleanup retries only temporary macOS busy responses."""
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest import mock

from ci_check import detach_image


class DetachImageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='usbf-ci-detach-')
        self.log = Path(self.temp.name) / 'hdiutil-detach.log'
        self.elapsed = 0

    def tearDown(self):
        self.temp.cleanup()

    def sleep(self, seconds):
        self.elapsed += seconds

    def test_busy_mount_retries_then_detaches_without_force(self):
        busy = subprocess.CompletedProcess([], 16, stdout='mount still open', stderr='Resource busy')
        detached = subprocess.CompletedProcess([], 0, stdout='', stderr='')
        with mock.patch('ci_check.time.monotonic', side_effect=lambda: self.elapsed), \
                mock.patch('ci_check.time.sleep', side_effect=self.sleep), \
                mock.patch('ci_check.subprocess.run', side_effect=[busy, detached]) as run, \
                mock.patch('builtins.print') as printed:
            detach_image('/Volumes/installed image', log_path=self.log)
        self.assertEqual(run.call_count, 2)
        for call in run.call_args_list:
            self.assertEqual(call.args[0], ['hdiutil', 'detach', '/Volumes/installed image', '-quiet'])
            self.assertFalse(call.kwargs['check'])
            self.assertTrue(call.kwargs['capture_output'])
            self.assertTrue(call.kwargs['text'])
        record = json.loads(self.log.read_text())
        self.assertEqual((record['returncode'], record['stdout'], record['stderr']), (16, 'mount still open', 'Resource busy'))
        self.assertEqual(printed.call_count, 1)
        self.assertTrue(printed.call_args.kwargs['flush'])

    def test_nonbusy_failure_propagates_without_retry(self):
        failure = subprocess.CompletedProcess(['hdiutil'], 8, stdout='diagnostic output', stderr='Invalid argument')
        with mock.patch('ci_check.time.monotonic', side_effect=lambda: self.elapsed), \
                mock.patch('ci_check.time.sleep') as sleep, \
                mock.patch('ci_check.subprocess.run', return_value=failure) as run, \
                mock.patch('builtins.print'), \
                self.assertRaises(subprocess.CalledProcessError) as caught:
            detach_image('/Volumes/image', log_path=self.log)
        self.assertEqual(run.call_count, 1)
        sleep.assert_not_called()
        self.assertEqual(caught.exception.returncode, 8)
        self.assertEqual(caught.exception.output, 'diagnostic output')
        self.assertEqual(caught.exception.stderr, 'Invalid argument')

    def test_busy_deadline_preserves_last_failure(self):
        busy = subprocess.CompletedProcess(['hdiutil'], 16, stdout='last output', stderr='still busy')
        with mock.patch('ci_check.time.monotonic', side_effect=lambda: self.elapsed), \
                mock.patch('ci_check.time.sleep', side_effect=self.sleep), \
                mock.patch('ci_check.subprocess.run', return_value=busy) as run, \
                mock.patch('builtins.print') as printed, \
                self.assertRaises(subprocess.CalledProcessError) as caught:
            detach_image('/Volumes/image', timeout=2, log_path=self.log)
        self.assertEqual(self.elapsed, 2)
        self.assertEqual(run.call_count, 2)
        self.assertEqual(printed.call_count, 2)
        self.assertEqual(len(self.log.read_text().splitlines()), 2)
        self.assertEqual(caught.exception.returncode, 16)
        self.assertEqual(caught.exception.output, 'last output')
        self.assertEqual(caught.exception.stderr, 'still busy')


if __name__ == '__main__':
    unittest.main()
