import unittest,sys,pathlib,tempfile,json,stat
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from cloud_sync import prepare_credentials,SECRET_NAMES
class CloudCredentials(unittest.TestCase):
 def test_only_required_fields_and_private_permissions(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/'credentials'
   prepare_credentials(dict(zip(SECRET_NAMES,['example-client','example-secret','example-refresh'])),p)
   config=json.loads((p/'config.json').read_text());token=json.loads((p/'token.json').read_text())
   self.assertEqual(set(config),{'client_id','client_secret','timezone'})
   self.assertEqual(set(token),{'refresh_token','expires_at'})
   self.assertEqual(stat.S_IMODE((p/'token.json').stat().st_mode),0o600)
 def test_missing_refresh_fails_before_writing(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/'credentials'
   with self.assertRaises(RuntimeError):prepare_credentials({SECRET_NAMES[0]:'example-client'},p)
   self.assertFalse(p.exists())
