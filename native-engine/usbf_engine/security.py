"""Public HTTPS trust is bundled with the isolated runtime, not a host Python."""
import ssl
import certifi


def https_context():
    return ssl.create_default_context(cafile=certifi.where())
