namespace VitalityNutri.Application.Abstractions.Processing;

public interface IUploadFileStorage
{
    Task<StoredUploadFile> SaveBase64PdfAsync(string fileName, string base64Content, CancellationToken cancellationToken);
    Task<StoredUploadFileInfo?> GetActiveFileAsync(string savedFileName, CancellationToken cancellationToken);
    Task DeleteFileIfExistsAsync(string savedFileName, CancellationToken cancellationToken);
    Task<string> ComputeFileHashAsync(string filePath, CancellationToken cancellationToken);
}

public sealed record StoredUploadFile(string SavedFileName, string FilePath, string FileHash);
public sealed record StoredUploadFileInfo(string SavedFileName, string FilePath);