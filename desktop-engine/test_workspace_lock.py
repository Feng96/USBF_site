"""Double-clicking the desktop application must not duplicate job workers."""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from launcher import workspace_lock


class WorkspaceLockTests(unittest.TestCase):
    def test_separate_process_cannot_claim_a_running_workspace(self):
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory)
            lock = workspace_lock(workspace)
            script = "import sys;sys.path.insert(0,sys.argv[1]);from launcher import workspace_lock;from pathlib import Path;workspace_lock(Path(sys.argv[2]))"
            command = [sys.executable, '-c', script, str(Path(__file__).parent), directory]
            try:
                blocked = subprocess.run(command, capture_output=True, text=True, timeout=20)
                self.assertNotEqual(blocked.returncode, 0)
                self.assertIn('already running', blocked.stderr)
            finally:
                lock.close()
            self.assertEqual(subprocess.run(command, capture_output=True, timeout=20).returncode, 0)

    def test_different_workspaces_run_independently(self):
        with tempfile.TemporaryDirectory() as directory:
            first = workspace_lock(Path(directory) / 'one')
            second = workspace_lock(Path(directory) / 'two')
            first.close()
            second.close()


if __name__ == '__main__':
    unittest.main()
