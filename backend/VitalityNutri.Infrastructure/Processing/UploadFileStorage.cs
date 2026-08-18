using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using VitalityNutri.Application.Abstractions.Processing;

namespace VitalityNutri.Infrastructure.Processing;

internal sealed class UploadFileStorage : IUploadFileStorage
{
    private static readonly string UploadsDirectory = Path.Combine(Directory.GetCurrentDirectory(), "data", "uploads");

    public async Task<StoredUploadFile> SaveBase64PdfAsync(string fileName, string base64Content, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(UploadsDirectory);

        var rawBase64 = base64Content.Contains(',') ? base64Content[(base64Content.IndexOf(',') + 1)..] : base64Content;
        var bytes = Convert.FromBase64String(rawBase64);
        var hash = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

        var sanitized = SanitizeFileName(Path.GetFileName(fileName));
        var savedFileName = $"{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}_{sanitized}";
        var filePath = Path.Combine(UploadsDirectory, savedFileName);
        await File.WriteAllBytesAsync(filePath, bytes, cancellationToken);

        return new StoredUploadFile(savedFileName, filePath, hash);
    }

    public Task<StoredUploadFileInfo?> GetActiveFileAsync(string savedFileName, CancellationToken cancellationToken)
    {
        var safeName = Path.GetFileName(savedFileName);
        var filePath = Path.Combine(UploadsDirectory, safeName);
        return Task.FromResult(File.Exists(filePath) ? new StoredUploadFileInfo(safeName, filePath) : null);
    }

    public Task DeleteFileIfExistsAsync(string savedFileName, CancellationToken cancellationToken)
    {
        var safeName = Path.GetFileName(savedFileName);
        var filePath = Path.Combine(UploadsDirectory, safeName);
        if (File.Exists(filePath))
        {
            File.Delete(filePath);
        }

        return Task.CompletedTask;
    }

    public async Task<string> ComputeFileHashAsync(string filePath, CancellationToken cancellationToken)
    {
        var bytes = await File.ReadAllBytesAsync(filePath, cancellationToken);
        return Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    }

    private static string SanitizeFileName(string fileName)
    {
        var normalized = fileName.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder();
        foreach (var character in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            builder.Append(char.IsLetterOrDigit(character) || character is '.' or '-' ? character : '_');
        }

        var sanitized = builder.ToString().Normalize(NormalizationForm.FormC);
        return string.IsNullOrWhiteSpace(sanitized) ? "upload.pdf" : sanitized;
    }
}