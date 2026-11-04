"""The packaged runtime verifies HTTPS without a host Python CA installation."""
import os
from pathlib import Path
import ssl
import sys
import unittest
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from usbf_engine.security import https_context


class HTTPSContextTests(unittest.TestCase):
    def test_bundled_public_trust_ignores_missing_host_ca_paths(self):
        with mock.patch.dict(os.environ, {'SSL_CERT_FILE': '/nonexistent-host-python/cert.pem', 'SSL_CERT_DIR': '/nonexistent-host-python/certs'}):
            context = https_context()
        self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
        self.assertTrue(context.check_hostname)
        self.assertGreater(len(context.get_ca_certs(binary_form=True)), 100)


if __name__ == '__main__':
    unittest.main()
