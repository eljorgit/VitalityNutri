using System.Text.Json;
using FluentValidation;
using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;

using Microsoft.Extensions.Localization;
using VitalityNutri.Application.Resources;

namespace VitalityNutri.Application.Backups;

public sealed record ImportBackupCommand(JsonElement Payload) : IRequest;

internal sealed class ImportBackupCommandValidator : AbstractValidator<ImportBackupCommand>
{
    public ImportBackupCommandValidator(IStringLocalizer<Messages> localizer)
    {
        RuleFor(command => command.Payload.ValueKind)
            .Equal(JsonValueKind.Object);
        RuleFor(command => command.Payload)
            .Must(payload => payload.TryGetProperty("plans", out var plans) && plans.ValueKind == JsonValueKind.Array)
            .WithMessage(_ => localizer[Messages.BackupInvalidFormat]);
    }
}

internal sealed class ImportBackupCommandHandler(IBackupRepository repository) : IRequestHandler<ImportBackupCommand>
{
    public Task Handle(ImportBackupCommand request, CancellationToken cancellationToken) =>
        repository.ImportAsync(request.Payload, cancellationToken);
}