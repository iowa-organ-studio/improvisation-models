\version "2.24.4"

% =========================================================
% USER SETTINGS
% =========================================================



% Historical/original intavolatura lines, TOP TO BOTTOM.

#(define RH-original
   '("D5" "B4" "G4" "E4" "C4"))

#(define LH-original
   '("G4" "E4" "C4" "A3" "F3" "D3" "B2" "G2"))


% Modern five-line staff, TOP TO BOTTOM.

#(define RH-modern
   '("F5" "D5" "B4" "G4" "E4"))

#(define LH-modern
   '("A3" "F3" "D3" "B2" "G2"))

%How to change the staff
 % % Prepare the OLD RH staff for the custos.
     % \prepareRHStaffChange #'("D5" "B4" "G4" "E4" "C4")
     % \break

     % % Change to the NEW RH staff for the following system.
     % \changeRHStaff #'("B4" "G4" "E4" "C4" "A3")


% Stage:
%
% 1 = fully modern
% 2 = almost modern
% 3 = intermediate
% 4 = almost historical
% 5 = historical

#(define stage 5)


% =========================================================
% PITCH FUNCTIONS
% =========================================================

#(define (pitch-in-list? pitch lst)
   (if (member pitch lst)
       #t
       #f))


#(define (pitch-letter-index pitch)
   (let ((letter
          (substring pitch 0 1)))
     (cond
       ((string=? letter "C") 0)
       ((string=? letter "D") 1)
       ((string=? letter "E") 2)
       ((string=? letter "F") 3)
       ((string=? letter "G") 4)
       ((string=? letter "A") 5)
       ((string=? letter "B") 6)
       (else
        (error "Unrecognized pitch" pitch)))))


#(define (pitch-octave pitch)
   (string->number
    (substring pitch 1)))


#(define (pitch-diatonic-number pitch)
   (+ (* 7 (pitch-octave pitch))
      (pitch-letter-index pitch)))


% The top line of the modern staff is assigned +4.
% Each diatonic step downward changes the position by 1.

#(define (pitch-position pitch modern)
   (+ 4
      (- (pitch-diatonic-number pitch)
         (pitch-diatonic-number
          (car modern)))))


% =========================================================
% LINE STATUS
% =========================================================

#(define (line-status pitch original modern)
   (cond
     ((and (pitch-in-list? pitch original)
           (pitch-in-list? pitch modern))
      '=)

     ((pitch-in-list? pitch modern)
      '+)

     ((pitch-in-list? pitch original)
      '-)

     (else
      'unknown)))


% =========================================================
% BUILD THE UNION OF TWO STAFF DEFINITIONS
% =========================================================

#(define (append-unique first second)
   (let loop ((remaining second)
              (result first))
     (if (null? remaining)
         result
         (let ((item (car remaining)))
           (if (member item result)
               (loop (cdr remaining) result)
               (loop (cdr remaining)
                     (append result (list item))))))))


#(define (sorted-pitches pitches modern)
   (sort
    pitches
    (lambda (a b)
      (> (pitch-position a modern)
         (pitch-position b modern)))))


% =========================================================
% FIND THE COMMON (=) LINES
% =========================================================

#(define (common-pitches original modern)
   (let loop ((remaining modern)
              (result '()))
     (if (null? remaining)
         result
         (let ((pitch (car remaining)))
           (if (pitch-in-list? pitch original)
               (loop (cdr remaining)
                     (append result (list pitch)))
               (loop (cdr remaining)
                     result))))))


% =========================================================
% FIND THE NON-COMMON (+ AND -) LINES
% =========================================================

#(define (extra-pitches original modern)
   (let ((all
          (append-unique original modern)))
     (sorted-pitches
      (filter
       (lambda (pitch)
         (not
          (and (pitch-in-list? pitch original)
               (pitch-in-list? pitch modern))))
       all)
      modern)))


% =========================================================
% STAFF COLORS
% =========================================================

#(define (gray value)
   (rgb-color value value value))


% +:
%
% Stage 1 = black
% Stage 2 = almost black
% Stage 3 = light gray
% Stage 4 = medium gray
% Stage 5 = invisible

#(define plus-gray
   (cond
     ((= stage 1) 0.00)
     ((= stage 2) 0.10)
     ((= stage 3) 0.33)
     ((= stage 4) 0.67)
     ((= stage 5) 1.00)
     (else
      (error "Stage must be 1 through 5"))))


% -:
%
% Stage 1 = invisible
% Stage 2 = almost invisible
% Stage 3 = light gray
% Stage 4 = dark gray
% Stage 5 = black

#(define minus-gray
   (cond
     ((= stage 1) 1.00)
     ((= stage 2) 0.90)
     ((= stage 3) 0.67)
     ((= stage 4) 0.33)
     ((= stage 5) 0.00)
     (else
      (error "Stage must be 1 through 5"))))


#(define plus-color
   (gray plus-gray))

#(define minus-color
   (gray minus-gray))

#(define equal-color
   (gray 0.00))


#(define (line-color pitch original modern)
   (let ((status
          (line-status pitch original modern)))
     (cond
       ((eq? status '+)
        plus-color)

       ((eq? status '-)
        minus-color)

       ((eq? status '=)
        equal-color)

       (else
        (gray 1.00)))))


% =========================================================
% GUIDE LINE
% =========================================================

#(define (make-guide x1 x2 y color thickness)
   (stencil-with-color
    (make-line-stencil thickness x1 y x2 y)
    color))


% =========================================================
% DRAW EXTRA LINES
% =========================================================

#(define (add-extra-guides base pitches original modern
                           x1 x2 thickness)
   (if (null? pitches)
       base
       (let* ((pitch
               (car pitches))

              (position
               (pitch-position pitch modern))

              (y
               (/ position 2.0))

              (color
               (line-color pitch original modern)))

         (add-extra-guides
          (ly:stencil-add
           base
           (make-guide
            x1 x2
            y
            color
            thickness))
          (cdr pitches)
          original
          modern
          x1
          x2
          thickness))))


% =========================================================
% ADAPTIVE STAFF STENCIL
% =========================================================

#(define (make-adaptive-staff-stencil original modern)
   (lambda (grob)
     (let* ((base
             (ly:staff-symbol::print grob))

            (x-ext
             (ly:stencil-extent base X))

            (x1
             (car x-ext))

            (x2
             (cdr x-ext))

            (thickness
             0.12)

            (extras
             (extra-pitches original modern)))

       (add-extra-guides
        base
        extras
        original
        modern
        x1
        x2
        thickness))))


% =========================================================
% ADAPTIVE STAFF LINE POSITIONS
% =========================================================

#(define (core-line-positions original modern)
   (sort
    (map
     (lambda (pitch)
       (pitch-position pitch modern))
     (common-pitches original modern))
    <))


% =========================================================
% ORIGINAL STAFF CHANGES AT SYSTEM BREAKS
%
% First prepare the OLD staff for the custos, then break,
% then change to the NEW staff for the following system.
%
% RH:
%   \prepareRHStaffChange #'(...)
%   \break
%   \changeRHStaff #'(...)
%
% LH:
%   \prepareLHStaffChange #'(...)
%   \changeLHStaff #'(...)
%
% The RH supplies the actual system break, so the LH does
% not need a second \break at the same musical point.
% =========================================================

#(define (original-line-positions original modern)
   (sort
    (map
     (lambda (pitch)
       (pitch-position pitch modern))
     original)
    <))


prepareRHStaffChange =
#(define-music-function
     (parser location original)
     (scheme?)
  #{
    \override Staff.Custos.ledger-positions =
      #(original-line-positions original RH-modern)
    \override Staff.Custos.no-ledgers = ##f
  #})


prepareLHStaffChange =
#(define-music-function
     (parser location original)
     (scheme?)
  #{
    \override Staff.Custos.ledger-positions =
      #(original-line-positions original LH-modern)
    \override Staff.Custos.no-ledgers = ##f
  #})


changeRHStaff =
#(define-music-function
     (parser location original)
     (scheme?)
  #{
    \stopStaff
    \override Staff.StaffSymbol.line-positions =
      #(core-line-positions original RH-modern)
    \override Staff.StaffSymbol.line-count =
      #(length (core-line-positions original RH-modern))
    \override Staff.StaffSymbol.stencil =
      #(make-adaptive-staff-stencil original RH-modern)
    \startStaff
  #})


changeLHStaff =
#(define-music-function
     (parser location original)
     (scheme?)
  #{
    \stopStaff
    \override Staff.StaffSymbol.line-positions =
      #(core-line-positions original LH-modern)
    \override Staff.StaffSymbol.line-count =
      #(length (core-line-positions original LH-modern))
    \override Staff.StaffSymbol.stencil =
      #(make-adaptive-staff-stencil original LH-modern)
    \startStaff
  #})

% =========================================================
% CLEFS
% =========================================================

#(define (stacked-treble-and-c-clef grob)
   (let* ((g-clef
           (grob-interpret-markup grob
             #{
               \markup
               \scale #'(0.50 . 0.50)
               \musicglyph "clefs.G"
             #}))
          (c-clef
           (grob-interpret-markup grob
             #{
               \markup
               \scale #'(0.45 . 0.45)
               \musicglyph "clefs.C"
             #}))
          (c-clef-down
           (ly:stencil-translate-axis
            c-clef
            -2.0
            Y)))
     (ly:stencil-add
      g-clef
      c-clef-down)))


#(define (stacked-bass-and-c-clef grob)
   (let* ((bass
           (grob-interpret-markup grob
             #{
               \markup
               \scale #'(0.70 . 0.70)
               \musicglyph "clefs.F"
             #}))
          (c-clef
           (grob-interpret-markup grob
             #{
               \markup
               \scale #'(0.45 . 0.45)
               \musicglyph "clefs.C"
             #}))
          (c-clef-up
           (ly:stencil-translate-axis
            c-clef
            2.0
            Y)))
     (ly:stencil-add
      bass
      c-clef-up)))


% =========================================================
% UPPER STAFF
% =========================================================

#(define upper-staff-with-colored-lines
   (make-adaptive-staff-stencil
    RH-original
    RH-modern))


% =========================================================
% LOWER STAFF
% =========================================================

#(define lower-staff-with-colored-lines
   (make-adaptive-staff-stencil
    LH-original
    LH-modern))


% =========================================================
% PAPER
% =========================================================

\paper {
  indent = 0
  line-width = #(* 1 mm 260)
  ragged-right = ##f
  ragged-bottom = ##t
  tagline = ##f

  system-system-spacing =
    #'((basic-distance . 18)
       (minimum-distance . 16)
       (padding . 3))
}


% =========================================================
% SCORE
% =========================================================

\score {
  \new PianoStaff <<

    % =====================================================
    % UPPER STAFF
    % =====================================================

    \new Staff \with {
      \consists "Custos_engraver"

      \override StaffSymbol.line-count =
        #(length (core-line-positions RH-original RH-modern))

      \override StaffSymbol.line-positions =
        #(core-line-positions RH-original RH-modern)

      \override StaffSymbol.stencil =
        #upper-staff-with-colored-lines

      \override Clef.stencil =
        #stacked-treble-and-c-clef

% to reinstate showing ALL versions of key signature flats
   %   \override KeySignature.flat-positions =
  %      #'((-7 . 6))
%
  %    \override KeyCancellation.flat-positions =
  %      #'((-7 . 6))

      \override Custos.style = #'mensural
      \override Custos.neutral-direction = #UP
      \override Custos.neutral-position = #100

      \clef treble
    } {
      
\transpose f TARGET_KEY {
  
      \key f \major
      \time 4/2
      \omit Staff.TimeSignature



    <<
    {
      \voiceOne
      a'2. bes'4 c''4 d''4 c''2~
    }
    \\
    {
      \voiceTwo
      f'2. g'4 a'2 g'
    }
  >>
  %2
  \noBreak
   <<
    {
      \voiceOne

      % Soprano
      c''2
      bes'2
      a'2
      g'2
    }
    \\
    {
      \voiceTwo

      % Alto
      a'2
      f'2~
      f'4
      e'16 f'16 e'16 f'16
      e'2
    }
  >>
  
  
   %3
  <<
    {
      \voiceOne
      f'2
      f'8\noBeam
      e'16[ f'16
      g'16 a'16 bes'16 c''16]
    }
    \\
    {
      \voiceTwo
      d'2
      d'8
      s8
      s8
      s8
    }
  >>
  %3.5
  {
    \voiceOne
    d''16[ e''16 f''16 d''16
    g''16 f''16 d''16 e''16]

    f''16[ e''16 f''16 e''16
    f''16 e''16 d''16 e''16] \noBreak
  }
  \break
  %4
  {
    \voiceOne
    f''2
  }
  %
  
}
    }


    % =====================================================
    % LOWER STAFF
    % =====================================================

    \new Staff \with {
      \consists "Custos_engraver"

      \override StaffSymbol.line-count =
        #(length (core-line-positions LH-original LH-modern))

      \override StaffSymbol.line-positions =
        #(core-line-positions LH-original LH-modern)

      \override StaffSymbol.stencil =
        #lower-staff-with-colored-lines

      \override Clef.stencil =
        #stacked-bass-and-c-clef

% to reinstate showing ALL versions of key signature flats
  %    \override KeySignature.flat-positions =
  %      #'((-7 . 6))

   %   \override KeyCancellation.flat-positions =
   %     #'((-7 . 6))

      \override Custos.style = #'mensural
      \override Custos.neutral-direction = #UP
      \override Custos.neutral-position = #100

      \clef bass
    } {
      
\transpose f TARGET_KEY {
  
      \key f \major
      \time 4/2
      \omit Staff.TimeSignature



     <<
    {
      \voiceOne
      c'1 a2 c'2
    }
    \\
    {
      \voiceTwo
      f1~ f2 e2
    }
  >>
  %2
  <<
    {
      \voiceOne
      f1
      c'2~ c'4
      bes4
    }
    \\
    {
      \voiceTwo
      d1
      c1
   
    }
  >>
 
  %3
  <<
    {
      \voiceOne
      a16 f16 g16 f16 g16 f16 g16 a16
      bes2
    }
    \\
    {
      \voiceTwo
      d2
      bes,2
    }
  >>
  %3.5
  <<
    {
      \voiceOne
      s2
      c'4
      bes4 \noBreak
    }
    \\
    {
      \voiceOne
      g2
      g2
    }
    \\
    {
      \voiceTwo
      bes,2
      c2
    }
  >> 
  
   %4
   <<
    {
      \voiceOne
      a2
    }
    \\
    {
      \voiceTwo
      f2
    }
    \\
    {
      \voiceTwo
      d2
    }
  >>
  
  
}
    }
  >>

  \layout {
    \context {
      \PianoStaff

      \override SystemStartBrace.stencil = ##f
      \override SystemStartBracket.stencil = ##f

      \override StaffGrouper.staff-staff-spacing =
        #'((basic-distance . 14)
           (minimum-distance . 12)
           (padding . 3))
    }
  }
}
