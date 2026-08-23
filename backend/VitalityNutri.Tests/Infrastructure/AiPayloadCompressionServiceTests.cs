using Microsoft.Extensions.Logging.Abstractions;
using PdfSharp.Drawing;
using PdfSharp.Pdf;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.PixelFormats;
using VitalityNutri.Infrastructure.Configuration;
using VitalityNutri.Infrastructure.Processing;
using SourcePdf = UglyToad.PdfPig.PdfDocument;

namespace VitalityNutri.Tests.Infrastructure;

public sealed class AiPayloadCompressionServiceTests
{
    private const int MinCompressionBytes = 262_144;

    [Fact]
    public void CompressPdfForAi_SmallPayload_ReturnsOriginalBytes()
    {
        var service = CreateService();
        var bytes = new byte[1024];

        var result = service.CompressPdfForAi(bytes);

        Assert.Same(bytes, result);
    }

    [Fact]
    public void CompressPdfForAi_InvalidPdf_ReturnsOriginalBytes()
    {
        var service = CreateService();
        var bytes = new byte[MinCompressionBytes + 4096];
        new Random(7).NextBytes(bytes);

        var result = service.CompressPdfForAi(bytes);

        Assert.Same(bytes, result);
    }

    [Fact]
    public void CompressImageForAi_SmallImage_ReturnsOriginalBytes()
    {
        var service = CreateService();
        var bytes = CreateNoisyPng(600, 400);

        var result = service.CompressImageForAi(bytes);

        Assert.Same(bytes, result);
    }

    [Fact]
    public void CompressImageForAi_OversizedImage_DownscalesAndShrinks()
    {
        var service = CreateService();
        var bytes = CreateNoisyPng(2400, 1600);

        var result = service.CompressImageForAi(bytes);

        Assert.True(result.Length < bytes.Length);
        using var image = SixLabors.ImageSharp.Image.Load(result);
        Assert.True(Math.Max(image.Width, image.Height) <= 1600);
    }

    [Fact]
    public void CompressPdfForAi_ScannedStylePdf_RebuildsWithSingleJpegRaster()
    {
        var service = CreateService();
        var original = CreateScannedStylePdf(CreateNoisyPng(2000, 1400));
        Assert.True(original.Length > MinCompressionBytes);

        var compressed = service.CompressPdfForAi(original);

        Assert.True(compressed.Length < original.Length * 0.9);
        using var stream = new MemoryStream(compressed);
        using var document = SourcePdf.Open(stream);
        var page = Assert.Single(document.GetPages());
        var pdfImage = Assert.Single(page.GetImages());
        Assert.True(pdfImage.RawBytes.Count > 2 && pdfImage.RawBytes[0] == 0xFF && pdfImage.RawBytes[1] == 0xD8);
        using var decoded = SixLabors.ImageSharp.Image.Load(pdfImage.RawBytes.ToArray());
        Assert.True(Math.Max(decoded.Width, decoded.Height) <= 1600);
    }

    private static AiPayloadCompressionService CreateService()
    {
        var configuration = new ApiConfiguration
        {
            Ai = new AiConfiguration
            {
                Pdf = new PdfConfiguration
                {
                    MaxVisionImageDimension = 1600,
                    VisionJpegQuality = 70,
                    MinCompressionBytes = MinCompressionBytes
                }
            }
        };

        return new AiPayloadCompressionService(configuration, NullLogger<AiPayloadCompressionService>.Instance);
    }

    private static byte[] CreateNoisyPng(int width, int height)
    {
        using var image = new Image<Rgb24>(width, height);
        var random = new Random(20260823);
        image.ProcessPixelRows(accessor =>
        {
            for (var y = 0; y < accessor.Height; y++)
            {
                var row = accessor.GetRowSpan(y);
                for (var x = 0; x < row.Length; x++)
                {
                    row[x] = new Rgb24((byte)random.Next(256), (byte)random.Next(256), (byte)random.Next(256));
                }
            }
        });

        using var output = new MemoryStream();
        image.Save(output, new PngEncoder());
        return output.ToArray();
    }

    private static byte[] CreateScannedStylePdf(byte[] rasterPng)
    {
        using var document = new PdfDocument();
        var page = document.AddPage();
        page.Width = XUnit.FromPoint(595);
        page.Height = XUnit.FromPoint(842);

        using (var image = XImage.FromStream(new MemoryStream(rasterPng)))
        using (var graphics = XGraphics.FromPdfPage(page))
        {
            graphics.DrawImage(image, 0, 0, page.Width.Point, page.Height.Point);
        }

        using var output = new MemoryStream();
        document.Save(output);
        return output.ToArray();
    }
}
