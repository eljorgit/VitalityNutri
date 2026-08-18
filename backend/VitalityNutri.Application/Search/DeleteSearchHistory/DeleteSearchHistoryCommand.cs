using FluentValidation;
using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;

namespace VitalityNutri.Application.Search.DeleteSearchHistory;

public sealed record DeleteSearchHistoryCommand(long Id) : IRequest;

internal sealed class DeleteSearchHistoryCommandValidator : AbstractValidator<DeleteSearchHistoryCommand>
{
    public DeleteSearchHistoryCommandValidator() => RuleFor(command => command.Id).GreaterThan(0);
}

internal sealed class DeleteSearchHistoryCommandHandler(ISearchHistoryRepository repository) : IRequestHandler<DeleteSearchHistoryCommand>
{
    public Task Handle(DeleteSearchHistoryCommand request, CancellationToken cancellationToken) =>
        repository.DeleteAsync(request.Id, cancellationToken);
}