using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;

namespace VitalityNutri.Application.Search.ClearSearchHistory;

public sealed record ClearSearchHistoryCommand : IRequest;

internal sealed class ClearSearchHistoryCommandHandler(ISearchHistoryRepository repository) : IRequestHandler<ClearSearchHistoryCommand>
{
    public Task Handle(ClearSearchHistoryCommand request, CancellationToken cancellationToken) =>
        repository.ClearAsync(cancellationToken);
}