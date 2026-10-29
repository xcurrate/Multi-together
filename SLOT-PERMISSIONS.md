# Slot permission controls

The dashboard can share access while keeping account creation under the owner's control.

## Enable owner controls

Choose one of these methods. The owner password must be private and at least 12 characters long. Do not reuse the dashboard login password.

### Hosting panel with environment variables

Set `SLOT_OWNER_PASSWORD` to your private password in the hosting panel, then restart the application.

### Hosting panel with File Manager only

Create a plain-text file named `slot-owner-password.txt` in the bot's project root (the same folder as `package.json`). Put only your private password in the file, save it, and restart the bot. Keep this file private; it is ignored by Git and must never be committed or shared. If both the environment variable and file are present, the environment variable takes precedence.

Open the dashboard and choose **IZIN SLOT AKUN**, or visit `/owner/slots`.

## Grant one account

1. Ask the recipient for the Discord User ID of the account they will add.
2. On the owner page, enter that ID and optionally add a note for the donation.
3. Confirm using the owner password.
4. The recipient can then add that account once through the existing new-account form.

An unused grant is stored in `slot-permissions.json`. After successful account creation it is marked `used`, and cannot be used to add a different account. A token refresh for an account already saved does not consume another grant.

Revoking an unused grant disables it. Revoking a used grant also removes the associated saved profile and requests its runtime to stop.

## Security notes

- The owner password is separate from dashboard HTTP Basic Auth.
- The guard checks requests server-side; hiding a button is not the security boundary.
- Changing the main token to a different account cannot be used as a shortcut around the grant check.
- The existing four-account ceiling is unchanged. This feature does not increase the hard maximum.
- Existing saved accounts are not retroactively locked by this feature.
