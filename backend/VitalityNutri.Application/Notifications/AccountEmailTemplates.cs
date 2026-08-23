namespace VitalityNutri.Application.Notifications;

/// <summary>Bilingual (ES/EN) HTML bodies for account-related transactional emails.</summary>
public static class AccountEmailTemplates
{
    public static string EmailChangeSubject(string language) =>
        IsSpanish(language)
            ? "Confirma tu nuevo correo electrónico - VitalityNutri"
            : "Confirm your new email address - VitalityNutri";

    public static string PasswordChangedSubject(string language) =>
        IsSpanish(language)
            ? "Tu contraseña ha sido cambiada - VitalityNutri"
            : "Your password has been changed - VitalityNutri";

    public static string EmailChangeBody(string language, string displayName, string newEmail, string confirmationUrl) =>
        IsSpanish(language) ? EmailChangeEs(displayName, newEmail, confirmationUrl) : EmailChangeEn(displayName, newEmail, confirmationUrl);

    public static string PasswordChangedBody(string language, string displayName, string utcTime) =>
        IsSpanish(language) ? PasswordChangedEs(displayName, utcTime) : PasswordChangedEn(displayName, utcTime);

    private static bool IsSpanish(string language) =>
        string.Equals(language?.Trim(), "es", StringComparison.OrdinalIgnoreCase);

    private static string Wrap(string inner) =>
        $"<div style=\"font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1f2937\">{inner}</div>";

    private static string EmailChangeEs(string displayName, string newEmail, string url) => Wrap($"""
        <h2>Hola {System.Net.WebUtility.HtmlEncode(displayName)},</h2>
        <p>Recibimos una solicitud para cambiar el correo de tu cuenta a <strong>{System.Net.WebUtility.HtmlEncode(newEmail)}</strong>.</p>
        <p>Para confirmar el cambio, haz clic en el siguiente enlace (v&aacute;lido durante 24 horas):</p>
        <p><a href="{url}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">Confirmar correo electr&oacute;nico</a></p>
        <p>Si no solicitaste este cambio, puedes ignorar este mensaje y tu correo actual seguir&aacute; activo.</p>
        <p style="color:#6b7280;font-size:13px">Equipo de VitalityNutri</p>
        """);

    private static string EmailChangeEn(string displayName, string newEmail, string url) => Wrap($"""
        <h2>Hi {System.Net.WebUtility.HtmlEncode(displayName)},</h2>
        <p>We received a request to change your account email to <strong>{System.Net.WebUtility.HtmlEncode(newEmail)}</strong>.</p>
        <p>To confirm the change, click the link below (valid for 24 hours):</p>
        <p><a href="{url}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">Confirm email address</a></p>
        <p>If you did not request this change, you can ignore this message and your current email will remain active.</p>
        <p style="color:#6b7280;font-size:13px">The VitalityNutri Team</p>
        """);

    private static string PasswordChangedEs(string displayName, string utcTime) => Wrap($"""
        <h2>Hola {System.Net.WebUtility.HtmlEncode(displayName)},</h2>
        <p>Tu contrase&ntilde;a se cambi&oacute; correctamente el {System.Net.WebUtility.HtmlEncode(utcTime)} (UTC).</p>
        <p>Si fuiste t&uacute;, no necesitas hacer nada m&aacute;s. Si NO reconoces esta actividad, restablece tu contrase&ntilde;a inmediatamente y contacta con soporte.</p>
        <p style="color:#6b7280;font-size:13px">Equipo de VitalityNutri</p>
        """);

    private static string PasswordChangedEn(string displayName, string utcTime) => Wrap($"""
        <h2>Hi {System.Net.WebUtility.HtmlEncode(displayName)},</h2>
        <p>Your password was successfully changed on {System.Net.WebUtility.HtmlEncode(utcTime)} (UTC).</p>
        <p>If this was you, no further action is needed. If you do NOT recognize this activity, reset your password immediately and contact support.</p>
        <p style="color:#6b7280;font-size:13px">The VitalityNutri Team</p>
        """);
}
