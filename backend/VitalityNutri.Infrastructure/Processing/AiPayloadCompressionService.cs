using Microsoft.Extensions.Logging;
using System.Diagnostics.CodeAnalysis;
using PdfSharp.Drawing;
using PdfSharp.Pdf;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;
using VitalityNutri.Infrastructure.Configuration;
using SourcePdfDocument = UglyToad.PdfPig.PdfDocument;

namespace VitalityNutri.Infrastructure.Processing;

internal interface IAiPayloadCompressionService
{
    byte[] CompressPdfForAi(byte[] pdfBytes);

    byte[] CompressImageForAi(byte[] imageBytes);
}

internal sealed class AiPayloadCompressionService(
    ApiConfiguration apiConfiguration,
    ILogger<AiPayloadCompressionService> logger)
    : IAiPayloadCompressionService
{
    private const double DominantImageCoverage = 0.5;
    private const double MinimumGainRatio = 0.9;

    public byte[] CompressPdfForAi(byte[] pdfBytes)
    {
        if (pdfBytes.Length <= Math.Max(0, apiConfiguration.Ai.Pdf.MinCompressionBytes))
        {
            return pdfBytes;
        }

        try
        {
            var compressed = CompressScannedPages(pdfBytes);
            if (compressed is null || compressed.Length >= pdfBytes.Length * MinimumGainRatio)
            {
                logger.LogInformation("[AiPayload] PDF compression produced no meaningful gain. Sending original ({Kb} KB).", pdfBytes.Length / 1024);
                return pdfBytes;
            }

            logger.LogInformation("[AiPayload] PDF optimized for AI vision: {OriginalKb} KB -> {CompressedKb} KB.", pdfBytes.Length / 1024, compressed.Length / 1024);
            return compressed;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[AiPayload] Unexpected failure while compressing PDF. Sending the original document.");
            return pdfBytes;
        }
    }

    public byte[] CompressImageForAi(byte[] imageBytes)
    {
        var maxDimension = ResolveMaxDimension();
        var quality = ResolveJpegQuality();

        try
        {
            using var image = Image.Load(imageBytes);
            if (Math.Max(image.Width, image.Height) <= maxDimension)
            {
                return imageBytes;
            }

            image.Mutate(ctx => ctx.Resize(new ResizeOptions
            {
                Mode = ResizeMode.Max,
                Size = new Size(maxDimension, maxDimension)
            }));

            using var output = new MemoryStream();
            image.Save(output, new JpegEncoder { Quality = quality });
            var compressed = output.ToArray();

            if (compressed.Length >= imageBytes.Length)
            {
                return imageBytes;
            }

            logger.LogInformation("[AiPayload] Image optimized for AI vision: {OriginalKb} KB -> {CompressedKb} KB.", imageBytes.Length / 1024, compressed.Length / 1024);
            return compressed;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[AiPayload] Unexpected failure while compressing image. Sending the original file.");
            return imageBytes;
        }
    }

    private byte[]? CompressScannedPages(byte[] pdfBytes)
    {
        var maxDimension = ResolveMaxDimension();
        var quality = ResolveJpegQuality();

        using var source = SourcePdfDocument.Open(pdfBytes);
        using var output = new PdfDocument();

        foreach (var page in source.GetPages())
        {
            var pageArea = page.Width * page.Height;
            var dominantImages = page.GetImages()
                .Where(i => i.Bounds.Width * i.Bounds.Height >= pageArea * DominantImageCoverage)
                .ToArray();

            if (dominantImages.Length != 1 || !TryExtractRaster(dominantImages[0], out var rasterBytes))
            {
                logger.LogDebug("[AiPayload] Page {PageNumber} has no single dominant raster image. Skipping PDF compression.", page.Number);
                return null;
            }

            using var raster = Image.Load(rasterBytes);
            raster.Mutate(ctx => ctx.Resize(new ResizeOptions
            {
                Mode = ResizeMode.Max,
                Size = new Size(maxDimension, maxDimension)
            }));

            using var jpegStream = new MemoryStream();
            raster.Save(jpegStream, new JpegEncoder { Quality = quality });

            var outputPage = output.AddPage();
            outputPage.Width = XUnit.FromPoint(page.Width);
            outputPage.Height = XUnit.FromPoint(page.Height);

            using var xImage = XImage.FromStream(new MemoryStream(jpegStream.ToArray()));
            using var graphics = XGraphics.FromPdfPage(outputPage);
            graphics.DrawImage(xImage, 0, 0, outputPage.Width.Point, outputPage.Height.Point);
        }

        using var outputStream = new MemoryStream();
        output.Save(outputStream);
        return outputStream.ToArray();
    }

    private static bool TryExtractRaster(UglyToad.PdfPig.Content.IPdfImage image, [NotNullWhen(true)] out byte[]? raster)
    {
        if (image.TryGetPng(out var png))
        {
            raster = png;
            return true;
        }

        var raw = image.RawBytes;
        if (raw.Count > 2 && raw[0] == 0xFF && raw[1] == 0xD8)
        {
            raster = raw.ToArray();
            return true;
        }

        raster = null;
        return false;
    }

    private int ResolveMaxDimension() =>
        Math.Clamp(apiConfiguration.Ai.Pdf.MaxVisionImageDimension, 320, 4096);

    private int ResolveJpegQuality() =>
        Math.Clamp(apiConfiguration.Ai.Pdf.VisionJpegQuality, 20, 95);
}
