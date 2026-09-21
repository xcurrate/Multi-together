function getCurrentProfile(client) {
    const user = client?.user;
    if (!user?.id || !user?.username) return null;

    return {
        id: user.id,
        username: user.username,
        global_name: user.globalName || null,
        avatar: user.avatar || null
    };
}

module.exports = { getCurrentProfile };
