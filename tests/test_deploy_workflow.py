import pathlib, unittest
class LocalDeployment(unittest.TestCase):
 def test_local_data_push_triggers_deploy_without_cloud_collection(self):
  workflow=(pathlib.Path(__file__).resolve().parents[1]/'.github/workflows/health-sync.yml').read_text()
  self.assertIn("- 'docs/**'",workflow)
  self.assertNotIn('schedule:',workflow)
  self.assertNotIn('cloud_sync.py',workflow)
  self.assertNotIn('GOOGLE_HEALTH_',workflow)
  self.assertIn('actions/deploy-pages@',workflow)
