// Basic NylasEnv to fetch configuration directory
function NylasEnvConstructor() {
}

NylasEnvConstructor.prototype.getConfigDirPath = function getConfigDirPath() {
  return process.env.PGP_CONFIG_DIR_PATH;
};

module.exports = new NylasEnvConstructor();
