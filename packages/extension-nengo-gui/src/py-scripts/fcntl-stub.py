import sys
import types
try:
    import fcntl
except ImportError:
    fcntl = types.ModuleType('fcntl')
    fcntl.LOCK_EX = 0x1
    fcntl.LOCK_SH = 0x2
    fcntl.LOCK_NB = 0x4
    fcntl.LOCK_UN = 0x8
    fcntl.flock = lambda fd, flags: None
    sys.modules['fcntl'] = fcntl
