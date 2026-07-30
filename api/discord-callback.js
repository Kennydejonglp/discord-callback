module.exports = async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Geen autorisatiecode ontvangen.');
  }

  const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
  const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
  const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
  const GUILD_ID = process.env.DISCORD_GUILD_ID;
  const CLIENT_ROLE_ID = process.env.DISCORD_CLIENT_ROLE_ID;
  const REDIRECT_URI = 'https://community.lifestyleperformance.nl/api/discord-callback';

  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      return res.status(400).send('Autorisatie mislukt. Probeer opnieuw.');
    }

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: 'Bearer ' + tokenData.access_token },
    });
    const userData = await userResponse.json();
    const userId = userData.id;

    const joinResponse = await fetch(
      'https://discord.com/api/guilds/' + GUILD_ID + '/members/' + userId,
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bot ' + BOT_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: tokenData.access_token,
          roles: [CLIENT_ROLE_ID],
        }),
      }
    );

    if (!joinResponse.ok && joinResponse.status !== 204) {
      const errText = await joinResponse.text();
      return res.status(500).send('Toevoegen aan server mislukt: ' + errText);
    }

    const roleResponse = await fetch(
      'https://discord.com/api/guilds/' + GUILD_ID + '/members/' + userId + '/roles/' + CLIENT_ROLE_ID,
      {
        method: 'PUT',
        headers: { Authorization: 'Bot ' + BOT_TOKEN },
      }
    );

    if (!roleResponse.ok) {
      const errText = await roleResponse.text();
      return res.status(500).send('Rol toewijzen mislukt: ' + errText);
    }

    return res.status(200).send(
      '<html><body style="font-family: sans-serif; text-align: center; padding: 60px;">' +
      '<h1>Welkom bij de exclusieve community!</h1>' +
      '<p>Je account is succesvol gekoppeld en geupgraded.</p>' +
      '</body></html>'
    );
  } catch (err) {
    return res.status(500).send('Er ging iets mis. Probeer het later opnieuw.');
  }
};

