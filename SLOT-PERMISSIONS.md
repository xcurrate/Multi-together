# Slot permission controls

The dashboard can share access while keeping account creation under the owner's control.

## Enable owner controls

Set the environment variable `SLOT_OWNER_PASSWORD` to a private, randomly generated password of at least 12 characters, then restart the application. Do not reuse the dashboard login password and do not commit the value to source control.

For example, in a shell before starting the bot:

```sh
export SLOT_OWNER_PASSWORD='replace-with-a-long-random-secret'
npm start
```

On Windows PowerShell:

```powershell
$env:SLOT_OWNER_PASSWORD = "replace-with-a-long-random-secret"
npm start
```

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
