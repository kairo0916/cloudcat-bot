// utils/auth.js

function isOwner(interactionOrId) {
  const ownerId = process.env.MC_OWNER || process.env.DEV_USERS?.split(',')[0];
  const idToCheck = typeof interactionOrId === 'string' ? interactionOrId : interactionOrId?.user?.id;
  return idToCheck === ownerId;
}

function ownerOnly(interactionOrId) {
  return isOwner(interactionOrId);
}

module.exports = {
  isOwner,
  ownerOnly
};