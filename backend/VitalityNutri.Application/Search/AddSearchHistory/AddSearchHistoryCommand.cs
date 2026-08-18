using FluentValidation;
using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Search.AddSearchHistory;

public sealed record AddSearchHistoryCommand(
    long PlanId,
    string PlanName,
    string Day,
    string Meal,
    string RecipeName,
    string Image,
    bool IsActive) : IRequest;

internal sealed class AddSearchHistoryCommandValidator : AbstractValidator<AddSearchHistoryCommand>
{
    public AddSearchHistoryCommandValidator()
    {
        RuleFor(command => command.PlanId).NotEqual(0);
        RuleFor(command => command.Day).NotEmpty().MaximumLength(32);
        RuleFor(command => command.Meal).NotEmpty().MaximumLength(32);
        RuleFor(command => command.RecipeName).NotEmpty().MaximumLength(512);
        RuleFor(command => command.PlanName).MaximumLength(512);
        RuleFor(command => command.Image).MaximumLength(2048);
    }
}

internal sealed class AddSearchHistoryCommandHandler(ISearchHistoryRepository repository)
    : IRequestHandler<AddSearchHistoryCommand>
{
    public Task Handle(AddSearchHistoryCommand request, CancellationToken cancellationToken) =>
        repository.AddAsync(
            new SearchHistoryItem(request.PlanId, request.PlanName, request.Day, request.Meal, request.RecipeName, request.Image, request.IsActive),
            10,
            cancellationToken);
}