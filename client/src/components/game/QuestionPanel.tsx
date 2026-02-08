import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PublicQuestion } from "@shared/schema";

interface QuestionPanelProps {
  question: PublicQuestion;
  onSubmit: (answer: string) => void;
  isSubmitting: boolean;
}

export function QuestionPanel({ question, onSubmit, isSubmitting }: QuestionPanelProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [textAnswer, setTextAnswer] = useState("");

  const handleSubmit = () => {
    if (question.type === "mcq") {
      if (selectedAnswer) {
        onSubmit(selectedAnswer);
        setSelectedAnswer("");
      }
    } else {
      if (textAnswer.trim()) {
        onSubmit(textAnswer.trim());
        setTextAnswer("");
      }
    }
  };

  const getQuestionTypeLabel = () => {
    switch (question.type) {
      case "mcq":
        return "Choose the correct answer";
      case "fill":
        return "Fill in the blank";
      case "conjugation":
        return "Conjugate the verb";
      default:
        return "";
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto shadow-xl">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {getQuestionTypeLabel()}
          </span>
          <span className="text-xs text-muted-foreground">
            {question.category}
          </span>
        </div>
        <CardTitle className="font-display text-xl sm:text-2xl leading-relaxed text-center pt-2">
          {question.question}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {question.type === "mcq" && question.options ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {question.options.map((option, index) => (
              <Button
                key={index}
                variant={selectedAnswer === option ? "default" : "outline"}
                className={`min-h-[56px] text-base font-semibold transition-all ${
                  selectedAnswer === option
                    ? "ring-2 ring-primary ring-offset-2"
                    : ""
                }`}
                onClick={() => setSelectedAnswer(option)}
                disabled={isSubmitting}
                data-testid={`option-${index}`}
              >
                {option}
              </Button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              type="text"
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              placeholder={
                question.type === "conjugation"
                  ? "Type the conjugated form..."
                  : "Type your answer..."
              }
              className="text-center text-lg h-14 font-semibold"
              disabled={isSubmitting}
              data-testid="input-answer"
              onKeyDown={(e) => {
                if (e.key === "Enter" && textAnswer.trim()) {
                  handleSubmit();
                }
              }}
            />
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={
            isSubmitting ||
            (question.type === "mcq" ? !selectedAnswer : !textAnswer.trim())
          }
          className="w-full h-12 text-lg font-bold font-display"
          data-testid="button-submit-answer"
        >
          {isSubmitting ? "Checking..." : "Submit Answer"}
        </Button>
      </CardContent>
    </Card>
  );
}
