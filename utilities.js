const jwt = require('jsonwebtoken');
const User = require('./models/user.model');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async (err, rep) => {
    // console.log(rep);
    if (err) return res.sendStatus(403);
    let user = await User.findById(rep.id);

    req.user = await user;
    next();
  });
}

module.exports = {
  authenticateToken,
};
