// Basic NylasEnv to fetch configuration directory
function NylasEnvConstructor() {
}

NylasEnvConstructor.prototype.getConfigDirPath = function() {
  return process.env.PGP_CONFIG_DIR_PATH;
}

module.exports = new NylasEnvConstructor();
