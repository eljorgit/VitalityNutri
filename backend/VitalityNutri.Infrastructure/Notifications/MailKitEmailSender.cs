using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using MimeKit;
using VitalityNutri.Application.Abstractions.Notifications;
using VitalityNutri.Infrastructure.Configuration;

namespace VitalityNutri.Infrastructure.Notifications;

/// <summary>
/// SMTP transactional email sender (MailKit). When Email:Enabled is false the sender
/// logs the intent at debug level instead of delivering, so OSS deployments without
/// SMTP credentials keep working with degraded (no-email) flows.
/// </summary>
public sealed class MailKitEmailSender(
    ApiConfiguration apiConfiguration,
    ILogger<MailKitEmailSender> logger) : IEmailSender
{
    public async Task SendAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        var email = apiConfiguration.Email;
        if (!email.Enabled || string.IsNullOrWhiteSpace(email.Smtp.Host))
        {
            logger.LogDebug("[Email] Sending is disabled. Skipped mail to {To} with subject '{Subject}'.", toEmail, subject);
            return;
        }

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(email.From.Name, email.From.Address));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = subject;
        message.Body = new BodyBuilder { HtmlBody = htmlBody }.ToMessageBody();

        using var client = new SmtpClient();
        await client.ConnectAsync(email.Smtp.Host, email.Smtp.Port,
            email.Smtp.UseStartTls ? SecureSocketOptions.StartTls : SecureSocketOptions.Auto,
            cancellationToken);

        try
        {
            if (!string.IsNullOrWhiteSpace(email.Smtp.Username))
            {
                await client.AuthenticateAsync(email.Smtp.Username, email.Smtp.Password ?? string.Empty, cancellationToken);
            }

            await client.SendAsync(message, cancellationToken);
            await client.DisconnectAsync(true, cancellationToken);
            logger.LogInformation("[Email] Sent '{Subject}' to {To}.", subject, toEmail);
        }
        finally
        {
            if (client.IsConnected)
            {
                await client.DisconnectAsync(true, CancellationToken.None);
            }
        }
    }
}
